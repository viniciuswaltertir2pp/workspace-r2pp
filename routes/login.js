const { Router } = require('express');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/db.js');

const router = Router();
const ALLOWED_GOOGLE_DOMAIN = (process.env.ALLOWED_GOOGLE_DOMAIN || 'r2pp.com.br').toLowerCase();
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

function getEmailDomain(email = '') {
    return email.split('@')[1]?.toLowerCase() || '';
}

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

router.get('/auth/google/config', (_req, res) => {
    return res.status(200).json({
        ok: true,
        clientId: googleClientId,
        enabled: Boolean(googleClient),
        allowedDomain: ALLOWED_GOOGLE_DOMAIN
    });
});

router.post('/login/google', async (req, res) => {
    const { credential } = req.body;

    if (!googleClientId || !googleClient) {
        return res.status(503).json({
            ok: false,
            msg: 'Login com Google nao configurado no servidor'
        });
    }

    if (!credential) {
        return res.status(400).json({
            ok: false,
            msg: 'Token do Google nao informado'
        });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: googleClientId
        });
        const payload = ticket.getPayload();
        const email = payload?.email?.toLowerCase();

        if (!email || !payload?.email_verified) {
            return res.status(401).json({
                ok: false,
                msg: 'Conta Google invalida'
            });
        }

        if (getEmailDomain(email) !== ALLOWED_GOOGLE_DOMAIN) {
            return res.status(403).json({
                ok: false,
                msg: `Apenas e-mails @${ALLOWED_GOOGLE_DOMAIN} sao permitidos`
            });
        }

        req.session.usuario = {
            email,
            nome: payload.name || payload.given_name || email.split('@')[0]
        };

        return res.status(200).json({
            ok: true,
            msg: 'Logado com Google com sucesso'
        });
    } catch (_err) {
        return res.status(401).json({
            ok: false,
            msg: 'Falha ao validar login Google'
        });
    }
});

module.exports = router;
