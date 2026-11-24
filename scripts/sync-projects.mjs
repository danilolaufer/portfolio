// Genera data/projects.json a partir de los repos fijados en el perfil de GitHub.
//
// Orden de búsqueda de repos:
//   1. Repos fijados (GraphQL, necesita GITHUB_TOKEN; en la Action ya existe).
//   2. Repos fijados leídos del perfil público (sin token, para ejecutarlo en local).
//   3. Repos con el topic configurado en "extraTopic" (se añaden a los fijados).
//   4. Si no hay nada, los últimos repos con push.
//
// Texto de cada proyecto (de más a menos prioridad):
//   PORTFOLIO.md del repo  >  descripción del repo  >  primer párrafo del README.
//
// Uso:  node scripts/sync-projects.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(resolve(ROOT, 'portfolio.config.json'), 'utf8'));
const USER = config.user;
const MAX = config.maxProjects ?? 6;
const EXCLUDE = new Set((config.exclude ?? []).map((n) => n.toLowerCase()));
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const API = 'https://api.github.com';

async function gh(path, { accept = 'application/vnd.github+json', method = 'GET', body } = {}) {
  const headers = { Accept: accept, 'User-Agent': 'portfolio-sync', 'X-GitHub-Api-Version': '2022-11-28' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return accept.includes('json') && !accept.includes('html') ? res.json() : res.text();
}

// ---------- 1. Qué repos mostrar ----------

async function pinnedViaGraphQL() {
  if (!TOKEN) return null;
  const query = `query($login: String!) {
    user(login: $login) {
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes { ... on Repository { name owner { login } } }
      }
    }
  }`;
  try {
    const data = await gh('/graphql', { method: 'POST', body: { query, variables: { login: USER } } });
    const nodes = data?.data?.user?.pinnedItems?.nodes ?? [];
    return nodes.map((n) => `${n.owner.login}/${n.name}`);
  } catch (err) {
    console.warn('GraphQL no disponible:', err.message);
    return null;
  }
}

async function pinnedViaProfile() {
  try {
    const res = await fetch(`https://github.com/${USER}`, { headers: { 'User-Agent': 'Mozilla/5.0 portfolio-sync' } });
    if (!res.ok) return null;
    const html = await res.text();
    const found = [];
    // Cada tarjeta fijada enlaza a /owner/repo justo antes de <span class="repo">
    const re = /href="\/([\w.-]+)\/([\w.-]+)"[^>]*>\s*<span class="repo"/g;
    let m;
    while ((m = re.exec(html))) found.push(`${m[1]}/${m[2]}`);
    if (found.length) return [...new Set(found)];
    // Formato alternativo: solo el nombre (repos propios)
    const re2 = /<span class="repo"[^>]*>\s*([\w.-]+)\s*</g;
    while ((m = re2.exec(html))) found.push(`${USER}/${m[1]}`);
    return found.length ? [...new Set(found)] : null;
  } catch {
    return null;
  }
}

async function topicRepos() {
  if (!config.extraTopic) return [];
  const q = encodeURIComponent(`user:${USER} topic:${config.extraTopic}`);
  const data = await gh(`/search/repositories?q=${q}&sort=updated&per_page=30`);
  return (data?.items ?? []).map((r) => r.full_name);
}

async function recentRepos() {
  const data = await gh(`/users/${USER}/repos?sort=pushed&per_page=30&type=owner`);
  return (data ?? []).filter((r) => !r.fork).map((r) => r.full_name);
}

// ---------- 2. Utilidades de texto ----------

function parseFrontmatter(md) {
  const match = md.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: md };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([\w-]+)\s*:\s*(.*)\s*$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (/^\[.*\]$/.test(value)) {
      value = value.slice(1, -1).split(',').map((v) => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, '');
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^-?\d+$/.test(value)) value = Number(value);
    }
    data[kv[1].toLowerCase()] = value;
  }
  return { data, body: match[2] };
}

function toList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function stripMarkdown(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstParagraph(md) {
  const blocks = md.replace(/```[\s\S]*?```/g, '').split(/\r?\n\s*\r?\n/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (/^(#|!\[|\[!\[|<|\||-{3,}|={3,})/.test(trimmed)) continue;
    const text = stripMarkdown(trimmed);
    if (text.length >= 30) return text;
  }
  return '';
}

function truncate(text, max = 220) {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

function prettifyName(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

// Convierte rutas relativas del HTML de GitHub en absolutas y quita lo peligroso.
function fixHtml(html, fullName, branch) {
  const raw = `https://raw.githubusercontent.com/${fullName}/${branch}/`;
  const blob = `https://github.com/${fullName}/blob/${branch}/`;
  const isRelative = (url) => !/^(https?:|mailto:|data:|#|\/\/)/i.test(url);
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<a[^>]*class="anchor"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/\scontainer-lg/g, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/(href|src)="javascript:[^"]*"/gi, '$1="#"')
    .replace(/(<img[^>]*\ssrc=")([^"]+)"/gi, (m, pre, url) =>
      isRelative(url) ? `${pre}${raw}${url.replace(/^\.?\//, '')}"` : m)
    .replace(/(<a[^>]*\shref=")([^"]+)"/gi, (m, pre, url) =>
      isRelative(url) ? `${pre}${blob}${url.replace(/^\.?\//, '')}"` : m)
    .replace(/<a\s/gi, '<a target="_blank" rel="noopener" ');
}

function resolveAsset(url, fullName, branch) {
  if (!url) return '';
  if (/^(https?:|data:|\.\/multimedia\/)/.test(url)) return url;
  return `https://raw.githubusercontent.com/${fullName}/${branch}/${url.replace(/^\.?\//, '')}`;
}

// ---------- 3. Datos de cada repo ----------

async function buildProject(fullName, order) {
  const repo = await gh(`/repos/${fullName}`);
  if (!repo) return null;
  const branch = repo.default_branch;

  const [languages, portfolioRaw, readmeRaw] = await Promise.all([
    gh(`/repos/${fullName}/languages`).catch(() => ({})),
    gh(`/repos/${fullName}/contents/PORTFOLIO.md`, { accept: 'application/vnd.github.raw' }).catch(() => null),
    gh(`/repos/${fullName}/readme`, { accept: 'application/vnd.github.raw' }).catch(() => null),
  ]);

  const { data: meta, body: portfolioBody } = portfolioRaw ? parseFrontmatter(portfolioRaw) : { data: {}, body: '' };

  let detailHtml = '';
  if (portfolioBody.trim()) {
    detailHtml = await gh('/markdown', {
      method: 'POST',
      accept: 'text/html',
      body: { text: portfolioBody, mode: 'gfm', context: fullName },
    }).catch(() => '');
  } else if (readmeRaw) {
    detailHtml = await gh(`/repos/${fullName}/readme`, { accept: 'application/vnd.github.html' }).catch(() => '');
  }
  detailHtml = detailHtml ? fixHtml(detailHtml, fullName, branch) : '';

  const summary = truncate(
    meta.summary || repo.description || (readmeRaw && firstParagraph(readmeRaw)) || 'Proyecto publicado en GitHub.'
  );

  const languageNames = Object.keys(languages ?? {});
  const tech = toList(meta.tech).length ? toList(meta.tech) : [...new Set([...languageNames.slice(0, 4), ...(repo.topics ?? []).filter((t) => t !== config.extraTopic)])];

  const image =
    resolveAsset(meta.image, fullName, branch) ||
    config.images?.[repo.name] ||
    `https://opengraph.githubassets.com/${encodeURIComponent(repo.pushed_at)}/${fullName}`;

  return {
    name: repo.name,
    fullName,
    title: meta.title || prettifyName(repo.name),
    summary,
    detailHtml,
    hasPortfolioFile: Boolean(portfolioRaw),
    tech,
    language: repo.language,
    topics: repo.topics ?? [],
    stars: repo.stargazers_count,
    url: repo.html_url,
    demo: meta.demo || repo.homepage || '',
    image,
    pushedAt: repo.pushed_at,
    createdAt: repo.created_at,
    featured: meta.featured === true,
    order: typeof meta.order === 'number' ? meta.order : order,
  };
}

// ---------- 4. Principal ----------

let source = 'pinned';
let names = (await pinnedViaGraphQL()) ?? (await pinnedViaProfile()) ?? [];
const extra = await topicRepos().catch(() => []);
names = [...names, ...extra.filter((n) => !names.includes(n))];
names = names.filter((n) => !EXCLUDE.has(n.split('/')[1].toLowerCase()));
if (!names.length) {
  source = 'recent';
  names = (await recentRepos()).filter((n) => !EXCLUDE.has(n.split('/')[1].toLowerCase()));
}
names = names.slice(0, MAX);

const projects = (await Promise.all(names.map((n, i) => buildProject(n, i)))).filter(Boolean);
projects.sort((a, b) => a.order - b.order);
if (!projects.some((p) => p.featured)) {
  // Destaca el que tuvo el cambio más reciente.
  const latest = [...projects].sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))[0];
  if (latest) latest.featured = true;
}

const output = { user: USER, source, generatedAt: new Date().toISOString(), projects };
const outFile = resolve(ROOT, 'data/projects.json');

// No reescribe el archivo si solo cambia la fecha: así la Action no hace commits vacíos.
let previous = null;
try {
  previous = JSON.parse(await readFile(outFile, 'utf8'));
} catch {}
const same = previous && JSON.stringify({ ...previous, generatedAt: 0 }) === JSON.stringify({ ...output, generatedAt: 0 });
if (same) {
  console.log('Sin cambios en los proyectos.');
} else {
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(output, null, 2) + '\n');
  console.log(`data/projects.json actualizado (${source}): ${projects.map((p) => p.name).join(', ')}`);
}
