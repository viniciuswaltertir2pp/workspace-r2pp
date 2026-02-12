const { Router } = require('express');
const router = Router();

router.get('/sessao', (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({
            ok: false,
            msg: 'Sessao expirada ou inexistente'
        });
    }

    return res.status(200).json({
        ok: true,
        usuario: req.session.usuario
    });
});

router.get('/logout', (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            return next(err);
        }

        res.clearCookie('sid');
        return res.status(200).json({
            ok: true,
            msg: 'Logout realizado'
        });
    });
});

module.exports = router;
