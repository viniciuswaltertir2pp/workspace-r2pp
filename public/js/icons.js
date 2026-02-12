// Inicializacao dos icones Lucide
lucide.createIcons();

// Funcao de login simplificada para demonstracao
function logar() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const errorMsg = document.getElementById('errorMsg');

    if (email && senha) {
        errorMsg.classList.add('hidden');
        console.log("Tentativa de login com:", email);
        // Redirecionamento simulado
        window.location.href = 'index.html';
    } else {
        errorMsg.classList.remove('hidden');
    }
}
