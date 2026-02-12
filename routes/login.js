const { Router } = require('express');
const db = require('../db/db.js');

const router = Router();

router.post('/login', (req, res, next) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({
            ok: false,
            msg: 'Preencha e-mail e senha'
        });
    }

    db.query(
        'SELECT nome, email FROM usuarios WHERE email = ? AND senha = ?',
        [email, senha]
    )
        .then(([rows]) => {
            if (rows.length === 0) {
                return res.status(401).json({
                    ok: false,
                    msg: 'E-mail ou senha incorretos'
                });
            }

            req.session.usuario = {
                email: rows[0].email,
                nome: rows[0].nome
            };

            return res.status(200).json({
                ok: true,
                msg: 'Logado com sucesso'
            });
        })
        .catch(next);
});

module.exports = router;
