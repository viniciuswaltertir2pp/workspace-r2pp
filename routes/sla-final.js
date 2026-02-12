const { Router } = require("express");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { parse, isValid } = require("date-fns");

const router = Router();
const uploadDir = path.join(__dirname, "..", "uploads", "sla-final");
const arquivoPlanilha = path.join(uploadDir, "planilha.xlsx");
const upload = multer({ dest: uploadDir });

fs.mkdirSync(uploadDir, { recursive: true });

function requireSession(req, res, next) {
  if (!req.session?.usuario) {
    return res.status(401).json({
      ok: false,
      msg: "Sessao expirada ou inexistente",
    });
  }

  return next();
}

router.get("/sla-final", requireSession, (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "sla-final", "index.html"));
});

router.post("/api/sla-final/upload", requireSession, upload.single("arquivo"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        msg: "Arquivo nao enviado.",
      });
    }

    if (fs.existsSync(arquivoPlanilha)) {
      fs.unlinkSync(arquivoPlanilha);
    }

    fs.renameSync(req.file.path, arquivoPlanilha);

    return res.status(200).json({
      ok: true,
      msg: "Planilha enviada com sucesso.",
    });
  } catch (e) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      ok: false,
      msg: "Erro no upload: " + (e?.message || e),
    });
  }
});

function parseAnyDateTimeToMs(value) {
  if (!value) return -Infinity;
  const str = String(value).trim();
  if (!str) return -Infinity;

  // ISO / "2026-01-29 09:08:00" / "2026-01-29T09:08:00"
  const isoTry = Date.parse(str.replace(" ", "T"));
  if (!Number.isNaN(isoTry)) return isoTry;

  // BR: "dd/MM/yyyy HH:mm:ss" (ou sem hora)
  const [datePart, timePart = "00:00:00"] = str.split(" ");
  const dt = parse(`${datePart} ${timePart}`, "dd/MM/yyyy HH:mm:ss", new Date());
  if (isValid(dt)) return dt.getTime();

  return -Infinity;
}

function toISOFromOc(o) {
  const ms = parseAnyDateTimeToMs(o?.Data_Ocorrencia_Todas);
  if (!Number.isFinite(ms) || ms === -Infinity) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// =========================================================
// Horario de corte (SP sempre true; RJ valida < 07:00 SP)
// =========================================================
function antesHorariodeCorte(isoUtc, uf) {
  const ufNorm = String(uf || "").trim().toUpperCase();

  if (ufNorm === "SP") return true;
  if (ufNorm !== "RJ") return false;

  if (!isoUtc) return false;

  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return false;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;

  // RJ: considera corte as 07:00 no horario de SP
  return hour * 60 + minute < 7 * 60;
}

// =========================================================
// Date-only em SP (ignora hora)
// =========================================================
function getYMDInTZ(isoUtc, timeZone = "America/Sao_Paulo") {
  if (!isoUtc) return null;
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (t) => parts.find((p) => p.type === t)?.value;

  const y = Number(get("year"));
  const m = Number(get("month"));
  const day = Number(get("day"));

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return null;

  return new Date(Date.UTC(y, m - 1, day)); // só a data (UTC)
}

function addBusinessDaysDateOnly(dateUtc, n) {
  let days = Math.max(0, parseInt(n, 10) || 0);
  let cur = new Date(dateUtc.getTime());

  while (days > 0) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const wd = cur.getUTCDay(); // 0=dom, 6=sab
    const isWeekend = wd === 0 || wd === 6;
    if (!isWeekend) days--;
  }

  return cur;
}

function dentroDoPrazoDiasUteisDateOnly(isoInicial, isoFinal, diasUteis = 0, timeZone = "America/Sao_Paulo") {
  const iniDate = getYMDInTZ(isoInicial, timeZone);
  const fimDate = getYMDInTZ(isoFinal, timeZone);
  if (!iniDate || !fimDate) return false;

  const deadline = addBusinessDaysDateOnly(iniDate, diasUteis);
  return fimDate.getTime() <= deadline.getTime();
}

function todaySPDateOnly() {
  return getYMDInTZ(new Date().toISOString(), "America/Sao_Paulo");
}

function sameDaySP(isoA, isoB) {
  const a = getYMDInTZ(isoA, "America/Sao_Paulo");
  const b = getYMDInTZ(isoB, "America/Sao_Paulo");
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

// ✅ NOVO: se Em Rota cair em dia não útil (sab/dom), ganha +1 dia útil
function emRotaCaiuEmDiaNaoUtil(isoUtc, timeZone = "America/Sao_Paulo") {
  const d = getYMDInTZ(isoUtc, timeZone);
  if (!d) return false;
  const wd = d.getUTCDay(); // 0=dom, 6=sab
  return wd === 0 || wd === 6;
}

// =========================================================
// Helpers de ocorrência vs ocorrência
// =========================================================
function isFinalizadora(oc) {
  return oc === "Pedido Entregue" || oc === "Pedido Devolução" || oc === "Pedido Extraviado";
}

function isSemTratativa(oc) {
  return (
    oc === "Fechado - H. Comercial" ||
    oc === "Fechado - Mudança de endereço (Inativo)" ||
    oc === "Área de Risco" ||
    oc === "Destinatário Ausente" ||
    oc === "Destinatário Ausente 2" ||
    oc === "Destinatário Ausente 3"
  );
}

function isComTratativa(oc) {
  return (
    oc === "Endereço Não Encontrado" ||
    oc === "Endereço Incompleto" ||
    oc === "Destinatário Desconhecido" ||
    oc === "Pedido Recusado"
  );
}

function isCulpaTransportadora(oc) {
  return oc === "Item Volumoso" || oc === "Muita Chuva" || oc === "Problema No Veículo";
}

function isNomenclaturaInsucesso(oc) {
  return isSemTratativa(oc) || isComTratativa(oc) || isCulpaTransportadora(oc);
}

function isTratativa(oc) {
  return oc === "Aguardando Tratativa" || oc === "AG TRATATIVA" || oc === "AG. TRATATIVA";
}

function isAjustado(oc) {
  return oc === "Pedido Ajustado" || oc.startsWith("Pedido Ajustado");
}

function isRelevante(oc) {
  return (
    isFinalizadora(oc) ||
    isSemTratativa(oc) ||
    isComTratativa(oc) ||
    isCulpaTransportadora(oc) ||
    isTratativa(oc) ||
    isAjustado(oc)
  );
}

function acharProximaRelevante(ocorrencias, idxStart) {
  for (let i = idxStart + 1; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (isRelevante(oc)) {
      const data = toISOFromOc(ocorrencias[i]);
      if (!data) return null;
      return { idx: i, oc, data };
    }
  }
  return null;
}

function acharPedidoAjustadoDepois(ocorrencias, idxStart) {
  for (let i = idxStart + 1; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (isAjustado(oc)) {
      const data = toISOFromOc(ocorrencias[i]);
      if (!data) return null;
      return { idx: i, oc, data };
    }
  }
  return null;
}

function normalizarChaveCampo(chave) {
  return String(chave || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function extrairMotoristaListaEntrega(ocorrencia) {
  if (!ocorrencia || typeof ocorrencia !== "object") return "";

  const chavesPreferenciais = [
    "Motorista_Lista_Entrega",
    "Motorista Lista Entrega",
    "Motorista_ListaEntrega",
    "Motorista Lista de Entrega",
    "MotoristaListaEntrega",
  ];

  for (const chave of chavesPreferenciais) {
    const valor = String(ocorrencia[chave] || "").trim();
    if (valor) return valor;
  }

  for (const chave of Object.keys(ocorrencia)) {
    const norm = normalizarChaveCampo(chave);
    const pareceMotoristaListaEntrega =
      norm.includes("motorista") && norm.includes("lista") && norm.includes("entrega");
    if (!pareceMotoristaListaEntrega) continue;

    const valor = String(ocorrencia[chave] || "").trim();
    if (valor) return valor;
  }

  return "";
}

function getMotoristaListaEntrega(ocorrencias, idxEmRota) {
  const inicio = Number.isInteger(idxEmRota) && idxEmRota >= 0 ? idxEmRota : 0;

  // Prioriza as linhas a partir do "Em Rota"
  for (let i = inicio; i < ocorrencias.length; i++) {
    const motorista = extrairMotoristaListaEntrega(ocorrencias[i]);
    if (motorista) return motorista;
  }

  // Fallback: procura nas linhas anteriores
  for (let i = inicio - 1; i >= 0; i--) {
    const motorista = extrairMotoristaListaEntrega(ocorrencias[i]);
    if (motorista) return motorista;
  }

  return null;
}

function temRecebidoEntreTransferenciaEEmRota(ocorrencias, isoTransferencia, isoEmRota) {
  const msTransferencia = parseAnyDateTimeToMs(isoTransferencia);
  const msEmRota = parseAnyDateTimeToMs(isoEmRota);
  if (!Number.isFinite(msTransferencia) || !Number.isFinite(msEmRota)) return false;

  return ocorrencias.some((o) => {
    const oc = String(o?.Ocorrencia || "").trim().toUpperCase();
    if (!oc.includes("RECEBID")) return false;

    const msOc = parseAnyDateTimeToMs(o?.Data_Ocorrencia_Todas);
    if (!Number.isFinite(msOc)) return false;

    return msOc > msTransferencia && msOc < msEmRota;
  });
}

function acharDataCadastroPedido(ocorrencias) {
  for (const o of ocorrencias) {
    const oc = String(o?.Ocorrencia || "").trim();
    if (oc !== "EM TRANSFERÊNCIA ENTRE HUB's") continue;
    const data = toISOFromOc(o);
    if (data) return data;
  }

  for (const o of ocorrencias) {
    const oc = String(o?.Ocorrencia || "").trim();
    if (oc !== "Importada") continue;
    const data = toISOFromOc(o);
    if (data) return data;
  }

  for (const o of ocorrencias) {
    const data = toISOFromOc(o);
    if (data) return data;
  }

  return null;
}

function temOcorrencia(ocorrencias, predicate) {
  return ocorrencias.some((ocorrencia) => {
    const oc = String(ocorrencia?.Ocorrencia || "").trim();
    return predicate(oc);
  });
}

function temEtiquetado(ocorrencias) {
  return temOcorrencia(ocorrencias, (oc) => oc === "Pedido Etiquetado" || oc === "Recebido na Base");
}

function normalizarOcorrencia(oc) {
  return String(oc || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isNaoColetado(oc) {
  const n = normalizarOcorrencia(oc);
  return n.includes("nao coletado");
}

function temOcorrenciaDepois(ocorrencias, idxStart) {
  if (!Number.isInteger(idxStart) || idxStart < 0) return false;
  return idxStart < ocorrencias.length - 1;
}

function acharIndicePrimeiraTratativa(ocorrencias) {
  for (let i = 0; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (isTratativa(oc)) return i;
  }
  return -1;
}

function temPedidoAjustadoDepois(ocorrencias, idxStart) {
  if (!Number.isInteger(idxStart) || idxStart < 0) return false;
  for (let i = idxStart + 1; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (isAjustado(oc)) return true;
  }
  return false;
}

function classificarPendencia(ocorrencias, idxTransferencia) {
  const idxTratativa = acharIndicePrimeiraTratativa(ocorrencias);
  if (idxTratativa >= 0 && !temPedidoAjustadoDepois(ocorrencias, idxTratativa)) {
    return "AGUARDANDO_TRATATIVA";
  }

  const temEmRota = temOcorrencia(ocorrencias, (oc) => oc === "Em Rota");
  if (temEmRota) return "NAO_CLASSIFICADO";

  const temNaoColetado = temOcorrencia(ocorrencias, (oc) => isNaoColetado(oc));
  const temBaixaDepoisTransferencia = temOcorrenciaDepois(ocorrencias, idxTransferencia);

  // Só é "não recebido" se NÃO COLETADO no SVA OU se não houver nenhuma baixa após a transferência.
  if (temNaoColetado || (Number.isInteger(idxTransferencia) && idxTransferencia >= 0 && !temBaixaDepoisTransferencia)) {
    return "NAO_RECEBIDO_SEM_ETIQUETADO";
  }

  if (temEtiquetado(ocorrencias) && !temEmRota) {
    return "PROCESSO_NAO_SEGUIDO";
  }

  return "PROCESSO_NAO_SEGUIDO";
}

function acharIndiceTransferenciaEntreHubs(ocorrencias) {
  for (let i = 0; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (oc === "EM TRANSFERÊNCIA ENTRE HUB's") return i;
  }
  return -1;
}

function acharPrimeiroEtiquetadoAposTransferencia(ocorrencias, idxTransferencia) {
  if (!Number.isInteger(idxTransferencia) || idxTransferencia < 0) return null;

  for (let i = idxTransferencia + 1; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    const data = toISOFromOc(ocorrencias[i]);
    if (!data) continue;

    // regra: pega o PRIMEIRO "Pedido Etiquetado" após a transferência
    // e ANTES de insucessos (sem/com tratativa) ou finalizadoras
    if (isFinalizadora(oc) || isSemTratativa(oc) || isComTratativa(oc)) return null;
    if (oc === "Pedido Etiquetado" || oc === "Recebido na Base") return { idx: i, data };
  }

  return null;
}

function temEmRotaDepois(ocorrencias, idxStart) {
  const inicio = Number.isInteger(idxStart) && idxStart >= 0 ? idxStart + 1 : 0;
  for (let i = inicio; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (oc === "Em Rota") return true;
  }
  return false;
}

function acharPrimeiraComTratativaAposEmRota(ocorrencias, idxEmRota) {
  const inicio = Number.isInteger(idxEmRota) && idxEmRota >= 0 ? idxEmRota + 1 : 0;
  for (let i = inicio; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (!isComTratativa(oc)) continue;
    const data = toISOFromOc(ocorrencias[i]);
    if (!data) continue;
    return { idx: i, oc, data };
  }
  return null;
}

function acharPrimeiraTratativaApos(ocorrencias, idxStart) {
  const inicio = Number.isInteger(idxStart) && idxStart >= 0 ? idxStart + 1 : 0;
  for (let i = inicio; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (!isTratativa(oc)) continue;
    const data = toISOFromOc(ocorrencias[i]);
    if (!data) continue;
    return { idx: i, oc, data };
  }
  return null;
}

function verificarCulpaCdPorTratativa(ocorrencias, idxEmRota) {
  const comTratativa = acharPrimeiraComTratativaAposEmRota(ocorrencias, idxEmRota);
  if (!comTratativa) return null;

  const tratativa = acharPrimeiraTratativaApos(ocorrencias, comTratativa.idx);
  if (!tratativa) return { comTratativa, tratativa: null };

  const dentroPrazo = dentroDoPrazoDiasUteisDateOnly(comTratativa.data, tratativa.data, 1);
  if (!dentroPrazo) return { comTratativa, tratativa };

  return null;
}

function acharProximoEmRotaAposIndice(ocorrencias, idxStart) {
  const inicio = Number.isInteger(idxStart) && idxStart >= 0 ? idxStart + 1 : 0;
  for (let i = inicio; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (oc !== "Em Rota") continue;
    const data = toISOFromOc(ocorrencias[i]);
    if (!data) continue;
    return { idx: i, data };
  }
  return null;
}

function verificarCulpaCdPorAjustadoSemRota(ocorrencias) {
  for (let i = 0; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (!isAjustado(oc) && oc !== "Pedido Ajustado") continue;
    const dataAjustado = toISOFromOc(ocorrencias[i]);
    if (!dataAjustado) continue;

    const emRota = acharProximoEmRotaAposIndice(ocorrencias, i);
    if (!emRota) return { dataAjustado, dataEmRota: null };

    const dentroPrazo = dentroDoPrazoDiasUteisDateOnly(dataAjustado, emRota.data, 1);
    if (!dentroPrazo) return { dataAjustado, dataEmRota: emRota.data };
  }
  return null;
}

function acharPrimeiraSemTratativaAposEmRota(ocorrencias, idxEmRota) {
  const inicio = Number.isInteger(idxEmRota) && idxEmRota >= 0 ? idxEmRota + 1 : 0;
  for (let i = inicio; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (!isSemTratativa(oc)) continue;
    const data = toISOFromOc(ocorrencias[i]);
    if (!data) continue;
    return { idx: i, oc, data };
  }
  return null;
}

function acharRecebidoNaBaseApos(ocorrencias, idxStart) {
  const inicio = Number.isInteger(idxStart) && idxStart >= 0 ? idxStart + 1 : 0;
  for (let i = inicio; i < ocorrencias.length; i++) {
    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
    if (oc !== "Recebido na Base") continue;
    const data = toISOFromOc(ocorrencias[i]);
    if (!data) continue;
    return { idx: i, data };
  }
  return null;
}

function verificarCulpaCdPorRecebidoAposInsucesso(ocorrencias, idxEmRota) {
  const semTratativa = acharPrimeiraSemTratativaAposEmRota(ocorrencias, idxEmRota);
  if (!semTratativa) return null;

  const recebido = acharRecebidoNaBaseApos(ocorrencias, semTratativa.idx);
  if (!recebido) return null;

  if (temEmRotaDepois(ocorrencias, recebido.idx)) return null;

  return { semTratativa, recebido };
}

function verificarCulpaMotoristaPorRecebidoAposInsucesso(ocorrencias, idxEmRota) {
  const semTratativa = acharPrimeiraSemTratativaAposEmRota(ocorrencias, idxEmRota);
  if (!semTratativa) return null;

  const recebido = acharRecebidoNaBaseApos(ocorrencias, semTratativa.idx);
  if (!recebido) return null;

  const dentroPrazo = dentroDoPrazoDiasUteisDateOnly(semTratativa.data, recebido.data, 1);
  if (dentroPrazo) return null;

  return { semTratativa, recebido };
}

function formatarDataCadastro(isoUtc) {
  const ymd = getYMDInTZ(isoUtc, "America/Sao_Paulo");
  if (!ymd) return "SEM_DATA";

  const y = ymd.getUTCFullYear();
  const m = String(ymd.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ymd.getUTCDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
}

function garantirMetricasDataCadastro(mapa, dataCadastro) {
  if (!mapa[dataCadastro]) {
    mapa[dataCadastro] = {
      dataCadastro,
      totalPedidos: 0,
      emDia: 0,
      atraso: 0,
      pendente: 0,
    };
  }
  return mapa[dataCadastro];
}

function acharPrimeiraBaixaDepoisData(ocorrencias, isoReferencia) {
  const msReferencia = parseAnyDateTimeToMs(isoReferencia);
  if (!Number.isFinite(msReferencia)) return null;

  for (const o of ocorrencias) {
    const oc = String(o?.Ocorrencia || "").trim();
    if (!isFinalizadora(oc)) continue;

    const msOc = parseAnyDateTimeToMs(o?.Data_Ocorrencia_Todas);
    if (!Number.isFinite(msOc) || msOc <= msReferencia) continue;

    const data = toISOFromOc(o);
    if (!data) continue;

    return { oc, data };
  }

  return null;
}

function avaliarCulpaMotoristaNoAtraso(ocorrencias, dataPrimeiroEmRota, resultadoAtraso) {
  const referencia = resultadoAtraso?.dataReferenciaAtraso || dataPrimeiroEmRota;
  const baixa = acharPrimeiraBaixaDepoisData(ocorrencias, referencia);

  if (resultadoAtraso?.fluxoAtraso === "FLUXO_2_EM_ROTA") {
    const prazoFluxo2 = emRotaCaiuEmDiaNaoUtil(dataPrimeiroEmRota) ? 1 : 0;
    if (!baixa) return { culpaMotorista: true, baixa };

    const baixaAposPrazo = !dentroDoPrazoDiasUteisDateOnly(dataPrimeiroEmRota, baixa.data, prazoFluxo2);
    return { culpaMotorista: baixaAposPrazo, baixa };
  }

  // Outros fluxos (exceto fluxo 1): só culpa motorista quando houve baixa após o prazo do fluxo.
  if (!baixa) return { culpaMotorista: false, baixa: null };
  const prazo = Number.isFinite(resultadoAtraso?.prazoDiasUteisAtraso)
    ? resultadoAtraso.prazoDiasUteisAtraso
    : 0;
  const baixaAposPrazo = !dentroDoPrazoDiasUteisDateOnly(referencia, baixa.data, prazo);

  return { culpaMotorista: baixaAposPrazo, baixa };
}

// =========================================================
// REGRA NOVA (culpa transportadora):
// Item Volumoso / Muita Chuva / Problema No Veículo
// precisa ter, NO MESMO DIA, alguma dessas ocorrências ALVO.
// Se não tiver => ATRASO.
// =========================================================
function temOcorrenciaAlvoPosteriorMesmoDia(ocorrencias, idxStart, isoBase) {
  const diaBase = getYMDInTZ(isoBase, "America/Sao_Paulo");
  if (!diaBase) return false;

  for (let i = idxStart + 1; i < ocorrencias.length; i++) {
    const dt = toISOFromOc(ocorrencias[i]);
    if (!dt) continue;

    const diaAtual = getYMDInTZ(dt, "America/Sao_Paulo");
    if (!diaAtual) continue;

    // como está ordenado, quando mudar o dia já pode parar
    if (diaAtual.getTime() !== diaBase.getTime()) break;

    const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();

    if (
      oc === "Pedido Entregue" ||
      oc === "Pedido Devolução" ||
      oc === "Pedido Extraviado" ||
      oc === "Endereço Não Encontrado" ||
      oc === "Endereço Incompleto" ||
      oc === "Destinatário Desconhecido" ||
      oc === "Pedido Recusado" ||
      oc === "Fechado - H. Comercial" ||
      oc === "Fechado - Mudança de endereço (Inativo)" ||
      oc === "Área de Risco" ||
      oc === "Destinatário Ausente" ||
      oc === "Destinatário Ausente 2"
    ) {
      return true;
    }
  }

  return false;
}

// =========================================================
// Classificador pós Em Rota: ocorrência vs ocorrência
// =========================================================
function classificarPosEmRota(ocorrencias, idxEmRota, dataEmRota) {
  let idxBase = idxEmRota;
  let dataBase = dataEmRota;
  let tipoBase = "Em Rota";

  let tentativas = 0;
  let guard = 0;

  while (guard++ < 30) {
    // =========================
    // Base = Em Rota -> próxima ocorrência relevante:
    // - se Em Rota cair em dia útil: 0 dias úteis (mesmo dia)
    // - se Em Rota cair em dia não útil (sab/dom): 1 dia útil
    // =========================
    if (tipoBase === "Em Rota") {
      const prox = acharProximaRelevante(ocorrencias, idxBase);

      const diasUteisPrazo = emRotaCaiuEmDiaNaoUtil(dataBase) ? 1 : 0;

      if (!prox) {
        // se não existe próxima ocorrência, valida se AINDA está no prazo
        const baseDate = getYMDInTZ(dataBase, "America/Sao_Paulo");
        const hoje = todaySPDateOnly();
        if (!baseDate || !hoje) return { status: "PENDENTE", dataReferenciaAtraso: null };

        const deadline = addBusinessDaysDateOnly(baseDate, diasUteisPrazo);
        return hoje.getTime() <= deadline.getTime()
          ? { status: "EM_DIA", dataReferenciaAtraso: null }
          : {
              status: "ATRASO",
              dataReferenciaAtraso: dataBase,
              fluxoAtraso: "FLUXO_2_EM_ROTA",
              prazoDiasUteisAtraso: diasUteisPrazo,
            };
      }

      if (!dentroDoPrazoDiasUteisDateOnly(dataBase, prox.data, diasUteisPrazo)) {
        return {
          status: "ATRASO",
          dataReferenciaAtraso: dataBase,
          fluxoAtraso: "FLUXO_2_EM_ROTA",
          prazoDiasUteisAtraso: diasUteisPrazo,
        };
      }
      if (isFinalizadora(prox.oc)) return { status: "EM_DIA", dataReferenciaAtraso: null };

      idxBase = prox.idx;
      dataBase = prox.data;
      tipoBase = prox.oc;
      continue;
    }

    // =========================
    // CULPA TRANSPORTADORA (REGRA NOVA)
    // =========================
    if (isCulpaTransportadora(tipoBase)) {
      const okMesmoDia = temOcorrenciaAlvoPosteriorMesmoDia(ocorrencias, idxBase, dataBase);
      return okMesmoDia
        ? { status: "EM_DIA", dataReferenciaAtraso: null }
        : {
            status: "ATRASO",
            dataReferenciaAtraso: dataBase,
            fluxoAtraso: "OUTROS_FLUXOS",
            prazoDiasUteisAtraso: 0,
          };
    }

    // =========================
    // Tratativa -> Pedido Ajustado
    // REGRA:
    // - Se não tiver Pedido Ajustado: PARA (PENDENTE)
    // - Se tiver, a partir do Ajustado a próxima ocorrência tem até 1 dia útil
    // =========================
    if (isTratativa(tipoBase)) {
      const ajust = acharPedidoAjustadoDepois(ocorrencias, idxBase);
      if (!ajust) return { status: "PENDENTE", dataReferenciaAtraso: null };

      idxBase = ajust.idx;
      dataBase = ajust.data;
      tipoBase = "Pedido Ajustado";
      continue;
    }

    // =========================
    // Pedido Ajustado -> próxima ocorrência relevante em até 1 dia útil
    // Se não existir próxima ocorrência:
    // - se ainda está no prazo => EM DIA
    // - se estourou => ATRASO
    // =========================
    if (isAjustado(tipoBase) || tipoBase === "Pedido Ajustado") {
      const prox = acharProximaRelevante(ocorrencias, idxBase);

      if (!prox) {
        const baseDate = getYMDInTZ(dataBase, "America/Sao_Paulo");
        const hoje = todaySPDateOnly();
        if (!baseDate || !hoje) return { status: "PENDENTE", dataReferenciaAtraso: null };

        const deadline = addBusinessDaysDateOnly(baseDate, 1);
        return hoje.getTime() <= deadline.getTime()
          ? { status: "EM_DIA", dataReferenciaAtraso: null }
          : {
              status: "ATRASO",
              dataReferenciaAtraso: dataBase,
              fluxoAtraso: "OUTROS_FLUXOS",
              prazoDiasUteisAtraso: 1,
            };
      }

      if (!dentroDoPrazoDiasUteisDateOnly(dataBase, prox.data, 1)) {
        return {
          status: "ATRASO",
          dataReferenciaAtraso: dataBase,
          fluxoAtraso: "OUTROS_FLUXOS",
          prazoDiasUteisAtraso: 1,
        };
      }
      if (isFinalizadora(prox.oc)) return { status: "EM_DIA", dataReferenciaAtraso: null };

      idxBase = prox.idx;
      dataBase = prox.data;
      tipoBase = prox.oc;
      continue;
    }

    // =========================
    // Sem tratativa: ocorrência -> próxima ocorrência relevante em até 6 dias úteis
    // Se não existir próxima ocorrência:
    // - se ainda está no prazo => EM DIA
    // - se estourou => ATRASO
    // =========================
    if (isSemTratativa(tipoBase)) {
      tentativas++;
      if (tentativas > 3) {
        return {
          status: "ATRASO",
          dataReferenciaAtraso: dataBase,
          fluxoAtraso: "OUTROS_FLUXOS",
          prazoDiasUteisAtraso: 6,
        };
      }

      const prox = acharProximaRelevante(ocorrencias, idxBase);

      if (!prox) {
        const baseDate = getYMDInTZ(dataBase, "America/Sao_Paulo");
        const hoje = todaySPDateOnly();
        if (!baseDate || !hoje) return { status: "PENDENTE", dataReferenciaAtraso: null };

        const deadline = addBusinessDaysDateOnly(baseDate, 6);
        return hoje.getTime() <= deadline.getTime()
          ? { status: "EM_DIA", dataReferenciaAtraso: null }
          : {
              status: "ATRASO",
              dataReferenciaAtraso: dataBase,
              fluxoAtraso: "OUTROS_FLUXOS",
              prazoDiasUteisAtraso: 6,
            };
      }

      if (!dentroDoPrazoDiasUteisDateOnly(dataBase, prox.data, 6)) {
        return {
          status: "ATRASO",
          dataReferenciaAtraso: dataBase,
          fluxoAtraso: "OUTROS_FLUXOS",
          prazoDiasUteisAtraso: 6,
        };
      }
      if (isFinalizadora(prox.oc)) return { status: "EM_DIA", dataReferenciaAtraso: null };

      idxBase = prox.idx;
      dataBase = prox.data;
      tipoBase = prox.oc;
      continue;
    }

    // =========================
    // Com tratativa: ocorrência -> próxima ocorrência relevante em até 1 dia útil
    // Se não existir próxima ocorrência:
    // - se ainda está no prazo => EM DIA
    // - se estourou => ATRASO
    // =========================
    if (isComTratativa(tipoBase)) {
      const prox = acharProximaRelevante(ocorrencias, idxBase);

      if (!prox) {
        const baseDate = getYMDInTZ(dataBase, "America/Sao_Paulo");
        const hoje = todaySPDateOnly();
        if (!baseDate || !hoje) return { status: "PENDENTE", dataReferenciaAtraso: null };

        const deadline = addBusinessDaysDateOnly(baseDate, 1);
        return hoje.getTime() <= deadline.getTime()
          ? { status: "EM_DIA", dataReferenciaAtraso: null }
          : {
              status: "ATRASO",
              dataReferenciaAtraso: dataBase,
              fluxoAtraso: "OUTROS_FLUXOS",
              prazoDiasUteisAtraso: 1,
            };
      }

      if (!dentroDoPrazoDiasUteisDateOnly(dataBase, prox.data, 1)) {
        return {
          status: "ATRASO",
          dataReferenciaAtraso: dataBase,
          fluxoAtraso: "OUTROS_FLUXOS",
          prazoDiasUteisAtraso: 1,
        };
      }
      if (isFinalizadora(prox.oc)) return { status: "EM_DIA", dataReferenciaAtraso: null };

      idxBase = prox.idx;
      dataBase = prox.data;
      tipoBase = prox.oc;
      continue;
    }

    // fallback: tenta achar a próxima relevante e exige 0 (conservador)
    const prox = acharProximaRelevante(ocorrencias, idxBase);
    if (!prox) return { status: "PENDENTE", dataReferenciaAtraso: null };
    if (!dentroDoPrazoDiasUteisDateOnly(dataBase, prox.data, 0)) {
      return {
        status: "ATRASO",
        dataReferenciaAtraso: dataBase,
        fluxoAtraso: "OUTROS_FLUXOS",
        prazoDiasUteisAtraso: 0,
      };
    }
    if (isFinalizadora(prox.oc)) return { status: "EM_DIA", dataReferenciaAtraso: null };

    idxBase = prox.idx;
    dataBase = prox.data;
    tipoBase = prox.oc;
  }

  return { status: "PENDENTE", dataReferenciaAtraso: null };
}

// =========================================================
// Rota SLA
// =========================================================
function montarDadosKpiM2(ufParam) {
  const uf = String(ufParam || "").trim().toUpperCase();
  const pathFile = arquivoPlanilha;
  if (!fs.existsSync(pathFile)) {
    const erro = new Error("Planilha nao encontrada. Faca upload da planilha no Monitor SLA.");
    erro.status = 400;
    throw erro;
  }

  const wb = XLSX.readFile(pathFile);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const baseBruta = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

  // Filtra por UF
  const baseSuja = baseBruta.filter((coluna) => {
    const ufPlan = String(coluna.UF_Destinatario || "").trim().toUpperCase();
    return ufPlan === uf;
  });

  // Agrupa por Pedido
  const baseAgrupadaPorPedido = baseSuja.reduce((acc, linha) => {
    const pedido = String(linha.Pedido || "").trim();
    if (!pedido) return acc;
    (acc[pedido] ||= []).push(linha);
    return acc;
  }, {});

  // MAIS ANTIGO -> MAIS NOVO
  Object.values(baseAgrupadaPorPedido).forEach((ocorrencias) => {
    ocorrencias.sort(
      (a, b) => parseAnyDateTimeToMs(a.Data_Ocorrencia_Todas) - parseAnyDateTimeToMs(b.Data_Ocorrencia_Todas)
    );
  });

  let totalDePedidos = 0;

  const basePedidosComMaisDeTresTentativas = [];
  const basePedidosPendentes = [];
  const basePendentesNaoRecebido = [];
  const basePendentesAguardandoTratativa = [];
  const basePendentesProcessoNaoSeguido = [];
  const basePedidosEmDia = [];
  const basePedidosAtrasados = [];
  const baseAtrasosMotoristaDetalhe = [];
  const baseCulpaCD = [];
  const baseAtrasosOutros = [];
  const contagemMotoristasAtraso = {};
  const metricasPorDataCadastroMap = {};
  const resumoInsucessosPorDiaMap = {};
  const baseInsucessosDetalhados = [];

  for (const [pedido, ocorrencias] of Object.entries(baseAgrupadaPorPedido)) {
    totalDePedidos++;
    const dataCadastro = formatarDataCadastro(acharDataCadastroPedido(ocorrencias));
    const metricasDataCadastro = garantirMetricasDataCadastro(metricasPorDataCadastroMap, dataCadastro);
    metricasDataCadastro.totalPedidos++;

    for (let i = 0; i < ocorrencias.length; i++) {
      const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
      if (!isNomenclaturaInsucesso(oc)) continue;

      const dataInsucesso = toISOFromOc(ocorrencias[i]);
      if (!dataInsucesso) continue;

      const dataInsucessoDia = formatarDataCadastro(dataInsucesso);
      const chaveResumo = `${dataInsucessoDia}|||${oc}`;
      if (!resumoInsucessosPorDiaMap[chaveResumo]) {
        resumoInsucessosPorDiaMap[chaveResumo] = {
          dataInsucessoDia,
          nomenclatura: oc,
          quantidade: 0,
        };
      }
      resumoInsucessosPorDiaMap[chaveResumo].quantidade++;

      baseInsucessosDetalhados.push({
        pedido,
        dataInsucesso,
        dataInsucessoDia,
        nomenclatura: oc,
        motorista: extrairMotoristaListaEntrega(ocorrencias[i]) || "Sem Motorista",
      });
    }

    // ======================================
    // (opcional) filtro geral >3 insucessos (como você já fazia)
    // ======================================
    let ocorrenciasPorPedido = 0;
    for (const o of ocorrencias) {
      const oc = String(o.Ocorrencia || "").trim();
      if (
        oc === "Fechado - H. Comercial" ||
        oc === "Endereço Não Encontrado" ||
        oc === "Destinatário Ausente" ||
        oc === "Destinatário Ausente 2" ||
        oc === "Destinatário Ausente 3" ||
        oc === "Destinatário Desconhecido" ||
        oc === "Endereço Incompleto" ||
        oc === "Fechado - Mudança de endereço (Inativo)" ||
        oc === "Pedido Recusado" ||
        oc === "Área de Risco"
      ) {
        ocorrenciasPorPedido++;
      }
    }

    if (ocorrenciasPorPedido > 3) {
      basePedidosComMaisDeTresTentativas.push(pedido);
      continue;
    }

    // ======================================
    // Captura Transferência entre HUBs
    // ======================================
    const idxTransferenciaEntreHubs = acharIndiceTransferenciaEntreHubs(ocorrencias);
    const dataTransferenciaEntreHubs =
      idxTransferenciaEntreHubs >= 0 ? toISOFromOc(ocorrencias[idxTransferenciaEntreHubs]) : null;

    // ======================================
    // Captura primeiro Em Rota
    // ======================================
    let dataPrimeiroEmRota = null;
    let idxEmRota = -1;

    for (let i = 0; i < ocorrencias.length; i++) {
      const oc = String(ocorrencias[i]?.Ocorrencia || "").trim();
      if (oc === "Em Rota") {
        dataPrimeiroEmRota = toISOFromOc(ocorrencias[i]);
        idxEmRota = i;
        break;
      }
    }

    const registrarPendencia = () => {
      basePedidosPendentes.push(pedido);
      const motivo = classificarPendencia(ocorrencias, idxTransferenciaEntreHubs);
      if (motivo === "AGUARDANDO_TRATATIVA") {
        basePendentesAguardandoTratativa.push(pedido);
      } else if (motivo === "PROCESSO_NAO_SEGUIDO") {
        basePendentesProcessoNaoSeguido.push(pedido);
      } else {
        basePendentesNaoRecebido.push(pedido);
      }
    };

    // Sem Em Rota => pendente
    if (!dataPrimeiroEmRota || idxEmRota === -1) {
      registrarPendencia();
      metricasDataCadastro.pendente++;
      totalDePedidos--; // Remove os pedidos que estão pendentes (Ainda não foram recebidos no CD)
      continue;
    }

    const motoristaResponsavelRota = getMotoristaListaEntrega(ocorrencias, idxEmRota);

    // Sem Transferência => pendente
    if (!dataTransferenciaEntreHubs) {
      registrarPendencia();
      metricasDataCadastro.pendente++;
      continue;
    }

    // ======================================
    // Prazo Transferência -> Em Rota
    // ======================================
    let prazoAConsiderar = 1;
    if (antesHorariodeCorte(dataTransferenciaEntreHubs, uf)) prazoAConsiderar = 0;

    // RJ: se houver baixa "Recebido" entre Transferência e Em Rota, soma +1 dia útil no prazo.
    // Na prática para RJ fica:
    // - antes do corte: 0 -> 1 dia útil
    // - após o corte: 1 -> 2 dias úteis
    if (
      uf === "RJ" &&
      temRecebidoEntreTransferenciaEEmRota(ocorrencias, dataTransferenciaEntreHubs, dataPrimeiroEmRota)
    ) {
      prazoAConsiderar += 1;
    }

    if (!dentroDoPrazoDiasUteisDateOnly(dataTransferenciaEntreHubs, dataPrimeiroEmRota, prazoAConsiderar)) {
      // No fluxo Transferencia -> Em Rota, mantém somente o pedido.
      basePedidosAtrasados.push(pedido);

      // Culpa do CD quando houve Pedido Etiquetado após a transferência
      // (antes de insucessos/finalizadoras) e o Em Rota veio em atraso.
      const etiquetadoAposTransferencia = acharPrimeiroEtiquetadoAposTransferencia(
        ocorrencias,
        idxTransferenciaEntreHubs
      );
      const etiquetadoAntesDoEmRota =
        etiquetadoAposTransferencia &&
        etiquetadoAposTransferencia.idx < idxEmRota;

      if (etiquetadoAntesDoEmRota) {
        baseCulpaCD.push({
          pedido,
          motivo: "ETIQUETADO_EM_ROTA_ATRASO",
          dataTransferencia: dataTransferenciaEntreHubs,
          dataEtiquetado: etiquetadoAposTransferencia.data,
          dataComTratativa: null,
          dataAguardandoTratativa: null,
        });
      } else {
        baseAtrasosOutros.push(pedido);
      }

      metricasDataCadastro.atraso++;
      continue;
    }

    // ======================================
    // Pós Em Rota: ocorrência vs ocorrência
    // ======================================
    const resultado = classificarPosEmRota(ocorrencias, idxEmRota, dataPrimeiroEmRota);

    if (resultado.status === "EM_DIA") {
      basePedidosEmDia.push(pedido);
      metricasDataCadastro.emDia++;
    }
    else if (resultado.status === "ATRASO") {
      const culpaMotorista = avaliarCulpaMotoristaNoAtraso(ocorrencias, dataPrimeiroEmRota, resultado);

      // ======================================
      // Culpa do CD: somente na base de atrasados
      // Transferência -> primeiro Pedido Etiquetado (antes de insucessos/finalizadoras),
      // e sem Em Rota depois
      // ======================================
      const etiquetadoAposTransferencia = acharPrimeiroEtiquetadoAposTransferencia(
        ocorrencias,
        idxTransferenciaEntreHubs
      );
      const culpaCdTratativa = verificarCulpaCdPorTratativa(ocorrencias, idxEmRota);
      const culpaCdAjustado = verificarCulpaCdPorAjustadoSemRota(ocorrencias);
      const culpaCdRecebido = verificarCulpaCdPorRecebidoAposInsucesso(ocorrencias, idxEmRota);

      let cdEntry = null;
      if (etiquetadoAposTransferencia && !temEmRotaDepois(ocorrencias, etiquetadoAposTransferencia.idx)) {
        cdEntry = {
          pedido,
          motivo: "ETIQUETADO_SEM_ROTA",
          dataTransferencia: dataTransferenciaEntreHubs,
          dataEtiquetado: etiquetadoAposTransferencia.data,
          dataComTratativa: null,
          dataAguardandoTratativa: null,
        };
      } else if (culpaCdTratativa) {
        const motivoTratativa = culpaCdTratativa.tratativa ? "TRATATIVA_FORA_PRAZO" : "SEM_AG_TRATATIVA";
        cdEntry = {
          pedido,
          motivo: motivoTratativa,
          dataTransferencia: dataTransferenciaEntreHubs,
          dataEtiquetado: etiquetadoAposTransferencia?.data || null,
          dataComTratativa: culpaCdTratativa.comTratativa?.data || null,
          dataAguardandoTratativa: culpaCdTratativa.tratativa?.data || null,
        };
      } else if (culpaCdAjustado) {
        cdEntry = {
          pedido,
          motivo: "AJUSTADO_SEM_ROTA",
          dataTransferencia: dataTransferenciaEntreHubs,
          dataEtiquetado: etiquetadoAposTransferencia?.data || null,
          dataComTratativa: culpaCdAjustado.dataAjustado,
          dataAguardandoTratativa: culpaCdAjustado.dataEmRota,
        };
      } else if (culpaCdRecebido) {
        cdEntry = {
          pedido,
          motivo: "RECEBIDO_APOS_INSUCESSO",
          dataTransferencia: dataTransferenciaEntreHubs,
          dataEtiquetado: etiquetadoAposTransferencia?.data || null,
          dataComTratativa: culpaCdRecebido.semTratativa?.data || null,
          dataAguardandoTratativa: culpaCdRecebido.recebido?.data || null,
        };
      }

      const culpaMotoristaRecebido = verificarCulpaMotoristaPorRecebidoAposInsucesso(ocorrencias, idxEmRota);
      const deveAtribuirMotorista =
        culpaMotorista.culpaMotorista || Boolean(culpaMotoristaRecebido);

      if (deveAtribuirMotorista && motoristaResponsavelRota) {
        const nomeMotorista = motoristaResponsavelRota;
        contagemMotoristasAtraso[nomeMotorista] = (contagemMotoristasAtraso[nomeMotorista] || 0) + 1;
        baseAtrasosMotoristaDetalhe.push({
          pedido,
          motorista: nomeMotorista,
          ocorrenciaAposAtraso: culpaMotoristaRecebido
            ? "Recebido na Base"
            : culpaMotorista.baixa?.oc || "SEM_BAIXA",
          dataOcorrenciaAposAtraso: culpaMotoristaRecebido
            ? culpaMotoristaRecebido.recebido?.data || dataPrimeiroEmRota
            : culpaMotorista.baixa?.data || dataPrimeiroEmRota,
        });
      } else if (cdEntry) {
        baseCulpaCD.push(cdEntry);
      } else {
        baseAtrasosOutros.push(pedido);
      }

      const referenciaAtraso = resultado.dataReferenciaAtraso || dataPrimeiroEmRota;
      basePedidosAtrasados.push({
        pedido,
        motoristaDaOcorrencia: culpaMotorista.culpaMotorista ? motoristaResponsavelRota : null,
        ocorrenciaAposAtraso: culpaMotorista.baixa?.oc || "SEM_BAIXA",
        dataOcorrenciaAposAtraso: culpaMotorista.baixa?.data || referenciaAtraso,
      });
      metricasDataCadastro.atraso++;
    }
    else {
      registrarPendencia();
      metricasDataCadastro.pendente++;
    }
  }

  const totalAtrasosOcasionadosPorMotoristas = Object.values(contagemMotoristasAtraso).reduce(
    (acc, qtd) => acc + qtd,
    0
  );

  const metricasPorDataCadastro = Object.values(metricasPorDataCadastroMap).sort((a, b) => {
    const [da, ma, ya] = String(a.dataCadastro).split("/").map(Number);
    const [db, mb, yb] = String(b.dataCadastro).split("/").map(Number);
    const ta = Number.isFinite(ya) ? Date.UTC(ya, (ma || 1) - 1, da || 1) : Number.MAX_SAFE_INTEGER;
    const tb = Number.isFinite(yb) ? Date.UTC(yb, (mb || 1) - 1, db || 1) : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  metricasPorDataCadastro.forEach((item) => {
    item.slaDiaPercentual =
      item.totalPedidos > 0 ? Number(((item.emDia / item.totalPedidos) * 100).toFixed(2)) : 0;
  });

  const mediaSlaPorDiaPercentual =
    metricasPorDataCadastro.length > 0
      ? Number(
          (
            metricasPorDataCadastro.reduce((acc, item) => acc + item.slaDiaPercentual, 0) /
            metricasPorDataCadastro.length
          ).toFixed(2)
        )
      : 0;

  const slaGeralPercentual =
    totalDePedidos > 0 ? Number(((basePedidosEmDia.length / totalDePedidos) * 100).toFixed(2)) : 0;

  const rankingMotoristasAtraso = Object.entries(contagemMotoristasAtraso)
    .map(([motorista, quantidade]) => ({
      motorista,
      quantidade,
      percentual:
        totalAtrasosOcasionadosPorMotoristas > 0
          ? Number(((quantidade / totalAtrasosOcasionadosPorMotoristas) * 100).toFixed(2))
          : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.motorista.localeCompare(b.motorista, "pt-BR"));

  const totaisInsucessoPorDia = {};
  Object.values(resumoInsucessosPorDiaMap).forEach((item) => {
    totaisInsucessoPorDia[item.dataInsucessoDia] =
      (totaisInsucessoPorDia[item.dataInsucessoDia] || 0) + Number(item.quantidade || 0);
  });

  const toMsDataBr = (dataBr) => {
    const [dia, mes, ano] = String(dataBr || "").split("/").map(Number);
    if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) return -Infinity;
    return Date.UTC(ano, mes - 1, dia);
  };

  const resumoInsucessosPorDia = Object.values(resumoInsucessosPorDiaMap)
    .map((item) => {
      const totalDia = Number(totaisInsucessoPorDia[item.dataInsucessoDia] || 0);
      return {
        dataInsucessoDia: item.dataInsucessoDia,
        nomenclatura: item.nomenclatura,
        quantidade: item.quantidade,
        percentualDia: totalDia > 0 ? Number(((item.quantidade / totalDia) * 100).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => {
      const ta = toMsDataBr(a.dataInsucessoDia);
      const tb = toMsDataBr(b.dataInsucessoDia);
      if (tb !== ta) return tb - ta;
      return b.quantidade - a.quantidade || a.nomenclatura.localeCompare(b.nomenclatura, "pt-BR");
    });

  const totalInsucessos = baseInsucessosDetalhados.length;
  const resumo = {
    uf,
    totalDePedidos,
    totalEmDia: basePedidosEmDia.length,
    totalAtrasados: basePedidosAtrasados.length,
    totalPendentes: basePedidosPendentes.length,
    totalMaisDeTresTentativas: basePedidosComMaisDeTresTentativas.length,
    slaGeralPercentual,
    mediaSlaPorDiaPercentual,
    totalAtrasosOcasionadosPorMotoristas,
    totalInsucessos,
  };

  return {
    resumo,
    uf,
    totalDePedidos,
    totalEmDia: basePedidosEmDia.length,
    totalAtrasados: basePedidosAtrasados.length,
    totalPendentes: basePedidosPendentes.length,
    totalMaisDeTresTentativas: basePedidosComMaisDeTresTentativas.length,
    totalInsucessos,
    basePedidosEmDia,
    basePedidosAtrasados,
    basePedidosPendentes,
    basePendentesNaoRecebido,
    basePendentesAguardandoTratativa,
    basePendentesProcessoNaoSeguido,
    basePedidosComMaisDeTresTentativas,
    resumoInsucessosPorDia,
    baseInsucessosDetalhados,
    baseAtrasosMotoristaDetalhe,
    baseCulpaCD,
    baseAtrasosOutros,
    metricasPorDataCadastro,
    totalAtrasosOcasionadosPorMotoristas,
    rankingMotoristasAtraso,
    slaGeralPercentual,
    mediaSlaPorDiaPercentual,
    dadosOrganizados: {
      resumo,
      slaPorDataCadastro: metricasPorDataCadastro,
      rankingMotoristasAtraso,
      insucessos: {
        resumoPorDia: resumoInsucessosPorDia,
        detalhes: baseInsucessosDetalhados,
      },
      bases: {
        emDia: basePedidosEmDia,
        atrasados: basePedidosAtrasados,
        pendentes: basePedidosPendentes,
        pendentesNaoRecebido: basePendentesNaoRecebido,
        pendentesAguardandoTratativa: basePendentesAguardandoTratativa,
        pendentesProcessoNaoSeguido: basePendentesProcessoNaoSeguido,
        maisDeTresTentativas: basePedidosComMaisDeTresTentativas,
      },
      detalhesAtraso: {
        motoristas: baseAtrasosMotoristaDetalhe,
        culpaCD: baseCulpaCD,
        outros: baseAtrasosOutros,
      },
    },
  };
}

function extrairPedidoDaLinha(linha) {
  if (typeof linha === "string" || typeof linha === "number") return String(linha);
  if (linha && typeof linha === "object") return String(linha.pedido || linha.Pedido || "");
  return "";
}

function normalizarBaseParaLinhas(base, status) {
  return (Array.isArray(base) ? base : []).map((item) => {
    if (typeof item === "string" || typeof item === "number") {
      return { status, pedido: String(item) };
    }
    return {
      status,
      pedido: extrairPedidoDaLinha(item),
      ...item,
    };
  });
}


router.get("/api/sla-final/v1/m2/:uf", requireSession, (req, res) => {
  try {
    const dados = montarDadosKpiM2(req.params.uf);
    return res.json(dados);
  } catch (erro) {
    return res.status(erro?.status || 500).json({ mensagem: erro?.message || "Erro ao processar KPI." });
  }
});

router.get("/api/sla-final/v1/m2/:uf/xlsx", requireSession, (req, res) => {
  try {
    const dados = montarDadosKpiM2(req.params.uf);
    const wb = XLSX.utils.book_new();

    const resumoRows = Object.entries(dados.resumo || {}).map(([indicador, valor]) => ({
      indicador,
      valor,
    }));
    const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    const wsSlaDia = XLSX.utils.json_to_sheet(dados.metricasPorDataCadastro || []);
    XLSX.utils.book_append_sheet(wb, wsSlaDia, "SLA por Dia");

    const wsMotoristas = XLSX.utils.json_to_sheet(
      (dados.rankingMotoristasAtraso || []).map((item, idx) => ({
        posicao: idx + 1,
        ...item,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsMotoristas, "Drivers");

    const wsInsucessos = XLSX.utils.json_to_sheet(dados.resumoInsucessosPorDia || []);
    XLSX.utils.book_append_sheet(wb, wsInsucessos, "Insucessos por Dia");

    const wsInsucessosDetalhe = XLSX.utils.json_to_sheet(dados.baseInsucessosDetalhados || []);
    XLSX.utils.book_append_sheet(wb, wsInsucessosDetalhe, "Insucessos Detalhe");

    const wsEmDia = XLSX.utils.json_to_sheet(normalizarBaseParaLinhas(dados.basePedidosEmDia, "EM_DIA"));
    XLSX.utils.book_append_sheet(wb, wsEmDia, "Em Dia");

    const wsPendentes = XLSX.utils.json_to_sheet(normalizarBaseParaLinhas(dados.basePedidosPendentes, "PENDENTE"));
    XLSX.utils.book_append_sheet(wb, wsPendentes, "Pendentes");

    const wsAtrasados = XLSX.utils.json_to_sheet(
      normalizarBaseParaLinhas(dados.basePedidosAtrasados, "ATRASADO")
    );
    XLSX.utils.book_append_sheet(wb, wsAtrasados, "Atrasados");

    const wsMaisTres = XLSX.utils.json_to_sheet(
      normalizarBaseParaLinhas(dados.basePedidosComMaisDeTresTentativas, "MAIS_3_TENTATIVAS")
    );
    XLSX.utils.book_append_sheet(wb, wsMaisTres, "Mais de 3 Tentativas");

    const wsConsolidado = XLSX.utils.json_to_sheet([
      ...normalizarBaseParaLinhas(dados.basePedidosEmDia, "EM_DIA"),
      ...normalizarBaseParaLinhas(dados.basePedidosPendentes, "PENDENTE"),
      ...normalizarBaseParaLinhas(dados.basePedidosAtrasados, "ATRASADO"),
      ...normalizarBaseParaLinhas(dados.basePedidosComMaisDeTresTentativas, "MAIS_3_TENTATIVAS"),
    ]);
    XLSX.utils.book_append_sheet(wb, wsConsolidado, "Base Consolidada");

    const nomeArquivo = `kpi-m2-${String(dados.uf || "").toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    return res.end(buffer);
  } catch (erro) {
    return res.status(erro?.status || 500).json({ mensagem: erro?.message || "Erro ao gerar XLSX." });
  }
});

module.exports = router;
