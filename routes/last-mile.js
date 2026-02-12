const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");

const router = Router();

const uploadDir = path.join(__dirname, "..", "uploads", "last-mile");
const arquivoPlanilha = path.join(uploadDir, "planilha.xlsx");

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

const OCORRENCIAS_INSUCESSO = [
  "DESTINATARIO AUSENTE",
  "DESTINATARIO AUSENTE 2",
  "DESTINATARIO AUSENTE 3",
  "DESTINATARIO DESCONHECIDO",
  "ENDERECO INCOMPLETO",
  "ENDERECO NAO ENCONTRADO",
  "FECHADO - H. COMERCIAL",
  "FECHADO - INATIVO",
  "PEDIDO RECUSADO",
  "ACIDENTE EM ROTA",
  "MUITA CHUVA",
  "PROBLEMA NO VEICULO",
  "AREA DE RISCO",
  "ROUBO / FURTO",
  "RECEBIDO APOS HORARIO DE CORTE",
  "PEDIDO EXTRAVIADO",
  "PEDIDO DEVOLUCAO",
  "RECEBIDO NA BASE",
];

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

function parsePtDateTime(value) {
  if (!value || typeof value !== "string") return null;

  const [datePart, timePart] = value.trim().split(" ");
  if (!datePart || !timePart) return null;

  const [dayRaw, monthRaw, yearRaw] = datePart.split("/");
  const [hourRaw, minuteRaw, secondRaw = "0"] = timePart.split(":");

  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);

  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, second);
}

function isInWindow(date) {
  const now = new Date();
  const endWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    16,
    0,
    0,
    0
  );
  const startWindow = new Date(endWindow.getTime() - 24 * 60 * 60 * 1000);

  return date >= startWindow && date <= endWindow;
}

function isInsucesso(ocorrencia) {
  const ocorrenciaNormalizada = normalizeText(ocorrencia);
  return OCORRENCIAS_INSUCESSO.some((item) => ocorrenciaNormalizada.includes(item));
}

router.get("/last-mile", requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "last-mile", "index.html"));
});

router.get("/api/last-mile/buscar-base", requireSession, (req, res, next) => {
  try {
    if (!fs.existsSync(arquivoPlanilha)) {
      return res.status(404).json({
        ok: false,
        msg: "Planilha nao encontrada. Faca o upload do arquivo.",
      });
    }

    const workbook = XLSX.readFile(arquivoPlanilha);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const dadosBase = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const porRota = dadosBase.reduce((acc, item) => {
      const abertura = parsePtDateTime(item.Data_de_abertura_do_carregamento);
      if (!abertura || !isInWindow(abertura)) return acc;

      const rota = item.Lista_Entrega;
      if (!rota) return acc;

      const motorista =
        (item.Motorista_Lista_Entrega && item.Motorista_Lista_Entrega.trim()) ||
        "Sem Motorista";

      if (!acc[rota]) {
        acc[rota] = {
          motorista,
          rota,
          filial: item.Filial_Entrega || "",
          totalPedidos: 0,
          entregues: 0,
          insucessos: 0,
        };
      }

      const grupo = acc[rota];

      if (!grupo.filial && item.Filial_Entrega) {
        grupo.filial = item.Filial_Entrega;
      }

      if (!grupo.motorista || !grupo.motorista.trim()) {
        grupo.motorista = motorista;
      }

      grupo.totalPedidos += 1;

      const ocorrencia = normalizeText(item.Ultima_Ocorrencia);
      if (ocorrencia === "PEDIDO ENTREGUE") {
        grupo.entregues += 1;
      }

      if (isInsucesso(ocorrencia)) {
        grupo.insucessos += 1;
      }

      return acc;
    }, {});

    const resultado = Object.values(porRota)
      .map((grupo) => {
        const pendentes = grupo.totalPedidos - grupo.entregues - grupo.insucessos;

        const percEntrega = grupo.totalPedidos
          ? (grupo.entregues / grupo.totalPedidos) * 100
          : 0;

        const percRota = grupo.totalPedidos
          ? ((grupo.entregues + grupo.insucessos) / grupo.totalPedidos) * 100
          : 0;

        return {
          motorista: grupo.motorista,
          filial: grupo.filial,
          percEntrega: `${percEntrega.toFixed(1)} %`,
          rota: grupo.rota,
          totalPedidos: grupo.totalPedidos,
          entregues: grupo.entregues,
          pendentes,
          insucessos: grupo.insucessos,
          percRota: `${percRota.toFixed(1)} %`,
        };
      })
      .sort((a, b) => parseFloat(a.percRota) - parseFloat(b.percRota));

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
});

router.post("/api/last-mile/upload", requireSession, upload.single("arquivo"), (req, res, next) => {
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
    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return next(error);
  }
});

module.exports = router;