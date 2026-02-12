const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");

const router = Router();

const uploadDir = path.join(__dirname, "..", "uploads", "monitoramento-cargas");
const arquivoPlanilha = path.join(uploadDir, "planilha.xlsx");

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

const MILK_RUN_MOTORISTAS = new Set(
  [
    "JOAO BATISTA CARNEIRO",
    "GABRIEL SILVA DE FIGUEIREDO",
    "ELISAMA DE OLIVEIRA PEREIRA",
    "AROLDO MOREIRA DA SILVA JUNIOR",
    "JOSEMAR DA SILVA FEITOSA",
    "EDSON RODRIGUES DE FIGUEIREDO",
    "RENAN ALEXANDRE DA SILVA",
    "DANIEL BALTAZAR SIMOES FILHO",
    "LUCAS VINICIUS SOUZA SILVA",
    "JOSE CARLOS",
    "JOSEMAR DA SILVA FEITOSA - DEVOLUCAO",
    "JOAO BATISTA CARNEIRO - DEVOLUCAO",
    "ELISAMA DE OLIVEIRA PEREIRA 03",
    "ELISAMA DE OLIVEIRA PEREIRA - DEVOLUCAO",
    "HAROLDO RODRIGUES",
    "THALLYSSON MICCHELL MARCIEL DA SILVEIRA",
    "TCV COLETA",
    "RYAN WESLLEY SERAFIM VENTURA DA SILVA",
  ].map((nome) => normalizeText(nome))
);

function requireSession(req, res, next) {
  if (!req.session?.usuario) {
    return res.status(401).json({
      ok: false,
      msg: "Sessao expirada ou inexistente",
    });
  }

  return next();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function parseNumber(value) {
  let normalized = String(value ?? "").trim();
  if (!normalized) return 0;

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parsePerformance(value) {
  const raw = String(value ?? "").trim();
  if (!raw || normalizeText(raw) === "PENDENTE") {
    return 0;
  }

  const firstChunk = raw.split(".")[0].replace(",", ".");
  const performance = Number.parseFloat(firstChunk);
  return Number.isFinite(performance) ? performance : 0;
}

function processarPlanilha() {
  if (!fs.existsSync(arquivoPlanilha)) {
    const error = new Error("Planilha nao encontrada. Faca o upload do arquivo.");
    error.status = 404;
    throw error;
  }

  const workbook = XLSX.readFile(arquivoPlanilha);
  const nomeAba = workbook.SheetNames[0];
  const dados = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAba], {
    defval: "",
  });

  const rotas = [];

  dados.forEach((linha) => {
    const motorista = String(linha.Motorista || linha.motorista || "").trim();
    if (!motorista) return;

    if (MILK_RUN_MOTORISTAS.has(normalizeText(motorista))) return;

    const status = normalizeText(linha.status || linha.Status || "");
    if (status !== "EM ROTA") return;

    const performance = parsePerformance(linha.Perfomance ?? linha.Performance);
    const pendencia = performance >= 100 ? "Devolucao" : "Finalizacao";

    const quantidade = parseNumber(linha.Quantidade ?? linha.quantidade);
    const baixas = parseNumber(linha.baixas ?? linha.Baixas);

    const quantiaPendentesFinalizacao =
      pendencia === "Finalizacao" ? Math.max(0, quantidade - baixas) : 0;

    const dataAberturaRaw = String(
      linha.dtabertura || linha.Data_Abertura || linha.DataAbertura || ""
    ).trim();
    const dataAbertura = dataAberturaRaw ? dataAberturaRaw.split(" ")[0] : "";

    rotas.push({
      rota: String(linha["Id Carga"] || linha.Id_Carga || linha.rota || "").trim(),
      motorista,
      dataAbertura,
      filial: String(linha.Filial || linha.filial || "").trim(),
      performance,
      pendencia,
      quantiaPendentesFinalizacao,
    });
  });

  return rotas;
}

router.get("/monitoramento-cargas", requireSession, (_req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "monitoramento-cargas", "index.html")
  );
});

router.post("/api/monitoramento-cargas/processa-base", requireSession, (req, res, next) => {
  try {
    const rotas = processarPlanilha();
    return res.status(200).json(rotas);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({
        ok: false,
        msg: error.message,
      });
    }

    return next(error);
  }
});

router.post(
  "/api/monitoramento-cargas/upload",
  requireSession,
  upload.single("arquivo"),
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        msg: "Arquivo nao enviado.",
      });
    }

    try {
      if (fs.existsSync(arquivoPlanilha)) {
        fs.unlinkSync(arquivoPlanilha);
      }

      fs.renameSync(req.file.path, arquivoPlanilha);

      return res.status(200).json({
        ok: true,
        msg: "Planilha enviada com sucesso.",
      });
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return next(error);
    }
  }
);

module.exports = router;
