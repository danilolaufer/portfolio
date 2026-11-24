// Pinta la sección de proyectos a partir de data/projects.json,
// que genera la GitHub Action con los repos fijados en el perfil.

(() => {
    const grid = document.getElementById('projects-grid');
    if (!grid) {
        return;
    }

    // <main> tiene z-index propio: el modal debe colgar de <body> para quedar sobre el fondo oscuro.
    const modalRoot = document.getElementById('project-modal');
    if (modalRoot) document.body.appendChild(modalRoot);

    const filtersEl = document.getElementById('projects-filters');
    const sourceEl = document.getElementById('projects-source');
    const GITHUB_PROFILE = 'https://github.com/danilolaufer';
    let projects = [];

    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

    function timeAgo(iso) {
        const diff = (new Date(iso) - new Date()) / 1000;
        const units = [
            ['year', 31536000],
            ['month', 2592000],
            ['week', 604800],
            ['day', 86400],
            ['hour', 3600],
            ['minute', 60],
        ];
        for (const [unit, seconds] of units) {
            if (Math.abs(diff) >= seconds) {
                return rtf.format(Math.trunc(diff / seconds), unit);
            }
        }
        return 'ahora mismo';
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function link(href, className, text, icon) {
        const a = el('a', className);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener';
        if (icon) {
            a.appendChild(el('i', `bi ${icon}`));
            a.append(' ');
        }
        a.append(text);
        return a;
    }

    function techKey(tech) {
        return tech.toLowerCase();
    }

    function renderCard(project, index) {
        const col = el('div', 'col-12 col-md-6 col-lg-4 project-col');
        col.dataset.tech = project.tech.map(techKey).join('|');

        const card = el('article', `card-proyecto${project.featured ? ' featured-project' : ''}`);

        const imgLink = document.createElement('a');
        imgLink.href = project.demo || project.url;
        imgLink.target = '_blank';
        imgLink.rel = 'noopener';
        const img = el('img', 'card-img-top');
        img.src = project.image;
        img.alt = `Vista previa de ${project.title}`;
        img.loading = 'lazy';
        img.onerror = () => {
            img.onerror = null;
            img.src = `https://opengraph.githubassets.com/1/${project.fullName}`;
        };
        imgLink.appendChild(img);
        card.appendChild(imgLink);

        const body = el('div', 'p-3 card-proyecto-body');

        const meta = el('div', 'project-meta');
        if (project.featured) meta.appendChild(el('span', 'project-badge', 'Destacado'));
        meta.appendChild(el('span', 'project-updated', `Actualizado ${timeAgo(project.pushedAt)}`));
        body.appendChild(meta);

        body.appendChild(el('h5', 'card-title', project.title));
        body.appendChild(el('p', 'card-subtitle', project.summary));

        if (project.tech.length) {
            const chips = el('ul', 'project-tech');
            project.tech.slice(0, 5).forEach((t) => chips.appendChild(el('li', '', t)));
            body.appendChild(chips);
        }

        const actions = el('div', 'project-actions');
        const more = el('button', 'btn btn-outline-light btn-sm', 'Ver más');
        more.type = 'button';
        more.addEventListener('click', () => openModal(project));
        actions.appendChild(more);
        actions.appendChild(link(project.url, 'btn btn-primary btn-sm', 'Código', 'bi-github'));
        if (project.demo) {
            actions.appendChild(link(project.demo, 'btn btn-light btn-sm', 'Demo', 'bi-box-arrow-up-right'));
        }
        body.appendChild(actions);

        card.appendChild(body);
        col.appendChild(card);

        card.classList.add('reveal-on-scroll');
        card.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 70}ms`);
        return col;
    }

    function openModal(project) {
        document.getElementById('project-modal-title').textContent = project.title;

        const meta = document.getElementById('project-modal-meta');
        meta.replaceChildren();
        meta.appendChild(el('p', 'project-modal-summary', project.summary));
        const chips = el('ul', 'project-tech');
        project.tech.forEach((t) => chips.appendChild(el('li', '', t)));
        meta.appendChild(chips);
        meta.appendChild(el('p', 'project-updated', `Último cambio ${timeAgo(project.pushedAt)}`));

        const body = document.getElementById('project-modal-body');
        if (project.detailHtml) {
            // HTML renderizado y saneado por GitHub y por scripts/sync-projects.mjs
            body.innerHTML = project.detailHtml;
        } else {
            body.replaceChildren(el('p', 'text-muted-soft', 'Este repositorio todavía no tiene README ni PORTFOLIO.md con más detalles.'));
        }

        const actions = document.getElementById('project-modal-actions');
        actions.replaceChildren(link(project.url, 'btn btn-primary', 'Ver repositorio', 'bi-github'));
        if (project.demo) {
            actions.appendChild(link(project.demo, 'btn btn-light', 'Ver demo', 'bi-box-arrow-up-right'));
        }

        const modalEl = document.getElementById('project-modal');
        if (window.bootstrap) {
            window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    }

    function renderFilters() {
        const counts = new Map();
        projects.forEach((p) => p.tech.forEach((t) => {
            const key = techKey(t);
            const entry = counts.get(key) || { label: t, count: 0 };
            entry.count += 1;
            counts.set(key, entry);
        }));

        const techs = [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);
        filtersEl.replaceChildren();
        if (techs.length < 2) {
            return;
        }

        const makeButton = (key, label) => {
            const btn = el('button', 'filter-chip', label);
            btn.type = 'button';
            btn.dataset.filter = key;
            btn.setAttribute('aria-pressed', key === 'all' ? 'true' : 'false');
            btn.addEventListener('click', () => applyFilter(key));
            return btn;
        };

        filtersEl.appendChild(makeButton('all', 'Todos'));
        techs.forEach(([key, { label }]) => filtersEl.appendChild(makeButton(key, label)));
    }

    function applyFilter(key) {
        filtersEl.querySelectorAll('.filter-chip').forEach((btn) => {
            btn.setAttribute('aria-pressed', btn.dataset.filter === key ? 'true' : 'false');
        });
        grid.querySelectorAll('.project-col').forEach((col) => {
            const show = key === 'all' || col.dataset.tech.split('|').includes(key);
            col.hidden = !show;
        });
    }

    function render(data) {
        projects = data.projects || [];
        grid.replaceChildren(...projects.map(renderCard));
        renderFilters();

        const updated = data.generatedAt ? ` · sincronizado ${timeAgo(data.generatedAt)}` : '';
        sourceEl.replaceChildren(
            document.createTextNode(`${projects.length} proyectos fijados en `),
            link(GITHUB_PROFILE, '', 'mi GitHub'),
            document.createTextNode(updated)
        );

        requestAnimationFrame(() => {
            grid.querySelectorAll('.reveal-on-scroll').forEach((card) => card.classList.add('is-visible'));
        });
    }

    function renderError() {
        sourceEl.replaceChildren(
            document.createTextNode('No se pudieron cargar los proyectos. Puedes verlos en '),
            link(GITHUB_PROFILE, '', 'mi GitHub'),
            document.createTextNode('.')
        );
    }

    fetch('./data/projects.json', { cache: 'no-cache' })
        .then((res) => {
            if (!res.ok) throw new Error(res.status);
            return res.json();
        })
        .then(render)
        .catch(renderError);
})();
