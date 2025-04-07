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
