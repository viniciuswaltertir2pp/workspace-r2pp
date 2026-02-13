function mostrarInformativo(mensagem, cor) {
    const informativo = document.getElementById('informativo');
    informativo.innerText = mensagem;
    informativo.style.color = cor;
}

function redirecionarParaHome() {
    window.location.href = '../html/home.html';
}

function logar() {
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');

    const email = emailInput.value.trim();
    const senha = senhaInput.value;

    if (!email || !senha) {
        mostrarInformativo('Preencha todos os campos para continuar', 'red');
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
                mostrarInformativo(data.msg || 'E-mail ou senha invalidos', 'red');
                senhaInput.value = '';
                senhaInput.focus();
                return;
            }

            redirecionarParaHome();
        })
        .catch(() => {
            mostrarInformativo('Erro de conexao. Tente novamente.', 'red');
        });
}

function mostrarInfoGoogle(mensagem) {
    const googleMsg = document.getElementById('google-login-msg');
    googleMsg.innerText = mensagem;
    googleMsg.classList.remove('hidden');
}

function tratarRespostaGoogle(tokenGoogle) {
    if (!tokenGoogle?.credential) {
        mostrarInformativo('Token Google nao recebido. Tente novamente.', 'red');
        return;
    }

    fetch('/login/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: tokenGoogle.credential })
    })
        .then((response) =>
            response.json().then((data) => ({ response, data }))
        )
        .then(({ response, data }) => {
            if (!response.ok || !data.ok) {
                mostrarInformativo(data.msg || 'Falha no login com Google', 'red');
                return;
            }

            redirecionarParaHome();
        })
        .catch(() => {
            mostrarInformativo('Erro de conexao no login Google.', 'red');
        });
}

function renderizarBotaoGoogle(clientId, allowedDomain) {
    const container = document.getElementById('google-login-container');

    if (!window.google?.accounts?.id) {
        mostrarInfoGoogle('Nao foi possivel carregar o provedor Google.');
        return;
    }

    window.google.accounts.id.initialize({
        client_id: clientId,
        callback: tratarRespostaGoogle
    });

    container.innerHTML = '';
    window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: '320'
    });

    mostrarInfoGoogle(`Somente contas @${allowedDomain} sao permitidas.`);
}

function aguardarGoogle(callback) {
    let tentativas = 0;
    const maxTentativas = 20;
    const intervalo = setInterval(() => {
        tentativas += 1;
        if (window.google?.accounts?.id) {
            clearInterval(intervalo);
            callback();
            return;
        }

        if (tentativas >= maxTentativas) {
            clearInterval(intervalo);
            mostrarInfoGoogle('Nao foi possivel carregar o botao Google.');
        }
    }, 250);
}

function inicializarLoginGoogle() {
    fetch('/auth/google/config', { method: 'GET' })
        .then((response) =>
            response.json().then((data) => ({ response, data }))
        )
        .then(({ response, data }) => {
            if (!response.ok || !data.ok || !data.enabled || !data.clientId) {
                mostrarInfoGoogle('Login com Google indisponivel no momento.');
                return;
            }

            const allowedDomain = data.allowedDomain || 'r2pp.com.br';
            aguardarGoogle(() => renderizarBotaoGoogle(data.clientId, allowedDomain));
        })
        .catch(() => {
            mostrarInfoGoogle('Falha ao inicializar login com Google.');
        });
}

document.addEventListener('DOMContentLoaded', inicializarLoginGoogle);
