function logar() {
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const informativo = document.getElementById('informativo');

    const email = emailInput.value.trim();
    const senha = senhaInput.value;

    if (email === "" || senha === "") {
        informativo.innerText = "Preencha todos os campos para continuar";
        informativo.style.color = "red";
        return;
    }

    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
    })
        .then((response) =>
            response.json().then((data) => ({ response, data }))
        )
        .then(({ response, data }) => {
            if (!response.ok || !data.ok) {
                informativo.innerText = data.msg || 'E-mail ou senha invalidos';
                informativo.style.color = 'red';
                senhaInput.value = '';
                senhaInput.focus();
                return;
            }

            window.location.href = "../html/home.html"
        })
        .catch(() => {
            informativo.innerText = 'Erro de conexao. Tente novamente.';
            informativo.style.color = 'red';
        });
}
