

function createCodeLine() {
    const codeContainer = document.getElementById("codeContainer");
    if (!codeContainer) {
        return;
    }

    const codeLine = document.createElement("div");
    codeLine.classList.add("code-line");
    codeLine.innerText = codeSnippets[Math.floor(Math.random() * codeSnippets.length)];

    codeLine.style.left = `${Math.random() * 100}vw`;
    codeLine.style.top = "-5vh";
    codeLine.style.animationDuration = `${3 + Math.random() * 3}s`;

    codeContainer.appendChild(codeLine);

    setTimeout(() => {
        codeLine.remove();
    }, 5000);
}

setInterval(createCodeLine, 1000);

// proyectos

document.querySelectorAll('.toggle-detalle').forEach((btn) => {
    btn.addEventListener('click', () => {
        const card = btn.closest('.card-proyecto');
        if (card) {
            card.classList.toggle('abierto');
        }
    });
});

const downloadButton = document.querySelector('.download-btn');

if (downloadButton) {
    downloadButton.addEventListener('click', () => {
        const confirmation = document.createElement('div');
        confirmation.textContent = 'Descargando CV';
        confirmation.style.cssText = `
            position: fixed;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            font-weight: 600;
            animation: slideIn 0.3s ease;
            top: 24px;
            right: 24px;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(confirmation);

        setTimeout(() => {
            confirmation.remove();
            style.remove();
        }, 3000);
    });
}

const revealElements = document.querySelectorAll(
    '.section-title, .about-card, .metric, .card-proyecto, .skill-item, .experience-card, .contact-card'
);

revealElements.forEach((element, index) => {
    element.classList.add('reveal-on-scroll');
    element.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 70}ms`);
});

if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.16,
        rootMargin: '0px 0px -70px 0px'
    });

    revealElements.forEach((element) => revealObserver.observe(element));
} else {
    revealElements.forEach((element) => element.classList.add('is-visible'));
}
