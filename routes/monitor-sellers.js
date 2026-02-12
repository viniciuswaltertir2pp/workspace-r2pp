const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");

const router = Router();

const uploadDir = path.join(__dirname, "..", "uploads", "monitor-sellers");
const arquivoPlanilha = path.join(uploadDir, "planilha.xlsx");

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

const OCORRENCIAS_COLETA = new Set(
  [
    "COLETADO",
    "TRANSFERENCIA RECEBIDA",
    "ROMANEIO EM TRANSFERENCIA",
    "RECEBIDO NA BASE",
    "PEDIDO NAO COLETADO - SVA 06",
  ].map((item) => item.trim())
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

router.get("/monitor-sellers", requireSession, (_req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "public", "monitor-sellers", "index.html")
  );
});

router.get("/api/monitor-sellers/buscar-base", requireSession, (req, res, next) => {
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

    const sellers = dadosBase.reduce((acc, item) => {
      const seller = String(
        item.Seller_MR || item["Seller MR"] || item.SELLER_MR || item.Seller || "SEM_SELLER"
      ).trim();

      const ocorrencia = normalizeText(item.Ultima_Ocorrencia);
      const motorista = String(item.Motorista_Lista_Entrega || "").trim();
      const coletado = OCORRENCIAS_COLETA.has(ocorrencia);

      if (!acc[seller]) {
        acc[seller] = {
          seller,
          pedidosFaltandoColeta: 0,
          motoristasNaoColetados: new Set(),
        };
      }

      if (!coletado) {
        acc[seller].pedidosFaltandoColeta += 1;
        if (motorista) {
          acc[seller].motoristasNaoColetados.add(motorista);
        }
      }

      return acc;
    }, {});

    const resultado = Object.values(sellers)
      .map((item) => ({
        seller: item.seller,
        pedidosFaltandoColeta: item.pedidosFaltandoColeta,
        motoristasNaoColetados: [...item.motoristasNaoColetados].sort((a, b) =>
          a.localeCompare(b, "pt-BR")
        ),
        jaFoiColetado: item.pedidosFaltandoColeta === 0,
      }))
      .sort((a, b) => b.pedidosFaltandoColeta - a.pedidosFaltandoColeta);

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/api/monitor-sellers/upload",
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
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return next(error);
    }
  }
);

module.exports = router;
