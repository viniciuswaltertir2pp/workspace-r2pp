require('dotenv').config();

const express = require('express');
const path = require("path");
const session = require('express-session');
const rotaInicial = require('./routes/root');
const rotaLogin = require('./routes/login');
const rotaSession = require('./routes/session.js');
const rotaLastMile = require('./routes/last-mile');
const rotaMilk = require('./routes/milk');
const rotaMonitorSellers = require('./routes/monitor-sellers');
const rotaSlaFinal = require('./routes/sla-final');
const rotaMonitoramentoCargas = require('./routes/monitoramento-cargas');

const app = express();
const PORT = 3000;

//Configs
app.use(express.json());
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'troque-essa-chave-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));
app.use('/last-mile', (req, res, next) => {
  if (!req.session?.usuario) {
    return res.redirect('/');
  }

  return next();
});
app.use('/milk', (req, res, next) => {
  if (!req.session?.usuario) {
    return res.redirect('/');
  }

  return next();
});
app.use('/monitor-sellers', (req, res, next) => {
  if (!req.session?.usuario) {
    return res.redirect('/');
  }

  return next();
});
app.use('/sla-final', (req, res, next) => {
  if (!req.session?.usuario) {
    return res.redirect('/');
  }

  return next();
});
app.use('/monitoramento-cargas', (req, res, next) => {
  if (!req.session?.usuario) {
    return res.redirect('/');
  }

  return next();
});

//Rotas
app.use('/', rotaInicial);
app.use('/', rotaLogin);
app.use('/', rotaSession);
app.use('/', rotaLastMile);
app.use('/', rotaMilk);
app.use('/', rotaMonitorSellers);
app.use('/', rotaSlaFinal);
app.use('/', rotaMonitoramentoCargas);
app.use(express.static(path.join(__dirname, "public")));

//Erros
app.use((err, req, res, next) => {
  console.error('Erro na API:', err);
  res.status(500).json({
    ok: false,
    msg: 'Erro interno no servidor'
  });
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
