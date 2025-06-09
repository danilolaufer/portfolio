const codeSnippets= [
    "int main() { return 0; }",
    "console.log('Hola mundo')",
    "function test() { return true; }",
    "const x = Math.random();",
    "if (x > 0.5) alert('Wow');",
    "while(true) break;",
    "let str = 'Hello';",
    "document.querySelector('body');"    
];

function createCodeLine() {

    const codeContainer = document.getElementById("codeContainer");
    const codeLine = document.createElement("div");
    codeLine.classList.add("code-line");
    codeLine.innerText = codeSnippets[Math.floor(Math.random() * codeSnippets.length)];

    codeLine.style.left = Math.random() * 100 + "vw";
    codeLine.style.top = "-5vh";
    codeLine.style.animationDuration = (3 + Math.random() * 3) + "s";
    
    codeContainer.appendChild(codeLine);

    setTimeout(() =>{
        codeLine.remove();
    }, 5000);
}

setInterval(createCodeLine,1000);


//proyectos

document.querySelectorAll('.toggle-detalle').forEach(btn => {
    btn.addEventListener('click', () => {
        const card = btn.closest('.card-proyecto');
        card.classList.toggle('abierto');
    });
});


document.querySelector('.download-btn').addEventListener('click', function(e){
    const confirmation = document.createElement('div');
    confirmation.textContent = 'Descargando CV';
    confirmation.style.cssText= `
    position: fixed;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    font-weight: 600;
    animation: slideIn 0.3s ease;
    `;

    const style = document.createElement('style');
    style.textContent= `
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
