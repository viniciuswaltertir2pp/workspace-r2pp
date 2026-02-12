function logout() {
    fetch('/logout', {
        method: 'GET'
    })
        .then((response) =>
            response.json().then((data) => ({ response, data }))
        )
        .then(({ response, data }) => {
            if (!response.ok || !data.ok) {
                window.location.href = '../index.html';
                return;
            }

            window.location.href = '../index.html';
        })
        .catch(() => {
            window.location.href = '../index.html';
        });
}
