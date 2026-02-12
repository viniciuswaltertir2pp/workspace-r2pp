const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");

const router = Router();

const uploadDir = path.join(__dirname, "..", "uploads", "milk");
const arquivoPlanilha = path.join(uploadDir, "planilha.xlsx");

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

const OCORRENCIAS_VISITA_SELLER = new Set([
  "COLETADO",
  "VISITADO ( SEM PRODUTO PARA COLETAR )",
  "TRANSFERENCIA RECEBIDA",
  "ROMANEIO EM TRANSFERENCIA",
]);

const OCORRENCIAS_COLETA = new Set([
  "TRANSFERENCIA RECEBIDA",
  "COLETADO",
  "ROMANEIO EM TRANSFERENCIA",
  "RECEBIDO NA BASE",
]);

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

router.get("/milk", requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "milk", "index.html"));
});

router.get("/api/milk/buscar-base", requireSession, (req, res, next) => {
  try {
    if (!fs.existsSync(arquivoPlanilha)) {
      return res.status(404).json({
        ok: false,
        msg: "Planilha nao encontrada. Faca o upload do arquivo.",
      });
    }

    const workbook = XLSX.readFile(arquivoPlanilha);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const dadosBase = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const porRota = dadosBase.reduce((acc, item) => {
      const rota = String(item.Lista_Entrega || "").trim();
      if (!rota) return acc;

      const motorista =
        String(item.Motorista_Lista_Entrega || "").trim() || "Sem Motorista";

      if (!acc[rota]) {
        acc[rota] = {
          motorista,
          rota,
          filial: String(item.Filial_Entrega || "").trim(),
          totalPedidos: 0,
          entregues: 0,
          insucessos: 0,
          sellers: new Set(),
          sellersVisitados: new Set(),
        };
      }

      const grupo = acc[rota];
      grupo.totalPedidos += 1;

      const seller = String(
        item.Seller_MR ||
          item["Seller MR"] ||
          item.SELLER_MR ||
          item.Seller ||
          ""
      ).trim();

      const ocorrencia = normalizeText(item.Ultima_Ocorrencia);

      if (seller) {
        grupo.sellers.add(seller);
        if (OCORRENCIAS_VISITA_SELLER.has(ocorrencia)) {
          grupo.sellersVisitados.add(seller);
        }
      }

      if (OCORRENCIAS_COLETA.has(ocorrencia)) {
        grupo.entregues += 1;
      }

      return acc;
    }, {});

    const resultado = Object.values(porRota)
      .map((grupo) => {
        const pendentes = grupo.totalPedidos - grupo.entregues - grupo.insucessos;

        const percEntrega = grupo.sellers.size
          ? (grupo.sellersVisitados.size / grupo.sellers.size) * 100
          : 0;

        const percRota = grupo.totalPedidos
          ? ((grupo.entregues + grupo.insucessos) / grupo.totalPedidos) * 100
          : 0;

        const faltamPassar = Math.max(
          0,
          grupo.sellers.size - grupo.sellersVisitados.size
        );

        return {
          motorista: grupo.motorista,
          filial: grupo.filial,
          rota: grupo.rota,
          totalPedidos: grupo.totalPedidos,
          entregues: grupo.entregues,
          pendentes,
          insucessos: grupo.insucessos,
          totalSellers: grupo.sellers.size,
          sellersVisitados: grupo.sellersVisitados.size,
          faltamPassar,
          percEntrega: `${percEntrega.toFixed(1)} %`,
          percRota: `${percRota.toFixed(1)} %`,
        };
      })
      .sort((a, b) => parseFloat(a.percRota) - parseFloat(b.percRota));

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
});

router.post("/api/milk/upload", requireSession, upload.single("arquivo"), (req, res, next) => {
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