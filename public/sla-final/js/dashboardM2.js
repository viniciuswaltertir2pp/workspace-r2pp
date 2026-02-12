const ufSelect = document.getElementById("ufSelect");
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("chartTooltip");

const elSlaGeral = document.getElementById("kpiSlaGeral");
const elMediaSlaDia = document.getElementById("kpiMediaSlaDia");
const elTotal = document.getElementById("kpiTotal");
const elEmDia = document.getElementById("kpiEmDia");
const elEmAtraso = document.getElementById("kpiEmAtraso");
const elPendentes = document.getElementById("kpiPendentes");
const elAtrasosMotorista = document.getElementById("kpiAtrasosMotorista");
const elPendentesCard = document.getElementById("kpiPendentesCard");
const elAtrasadosCard = document.getElementById("kpiAtrasadosCard");
const elInsucessosCard = document.getElementById("kpiInsucessosCard");
const cardPendentes = document.getElementById("cardPendentes");
const btnAbrirPainelInsucessoDia = document.getElementById("btnAbrirPainelInsucessoDia");
const tbodyMotoristas = document.getElementById("tbodyMotoristas");
const tbodySlaDia = document.getElementById("tbodySlaDia");
const tbodyPendentes = document.getElementById("tbodyPendentes");
const tbodyAtrasados = document.getElementById("tbodyAtrasados");
const tbodyInsucessosDiasCard = document.getElementById("tbodyInsucessosDiasCard");
const painelInsucessoDia = document.getElementById("painelInsucessoDia");
const btnFecharInsucessoDia = document.getElementById("btnFecharInsucessoDia");
const tagTotalDiasInsucesso = document.getElementById("tagTotalDiasInsucesso");
const tbodyInsucessoDia = document.getElementById("tbodyInsucessoDia");
const painelInsucessoNomenclatura = document.getElementById("painelInsucessoNomenclatura");
const btnFecharInsucessoNomenclatura = document.getElementById("btnFecharInsucessoNomenclatura");
const subtituloPainelInsucessoNomenclatura = document.getElementById("subtituloPainelInsucessoNomenclatura");
const tagTotalNomenclaturasPainel = document.getElementById("tagTotalNomenclaturasPainel");
const tbodyInsucessoNomenclatura = document.getElementById("tbodyInsucessoNomenclatura");
const painelInsucessoDriver = document.getElementById("painelInsucessoDriver");
const btnFecharInsucessoDriver = document.getElementById("btnFecharInsucessoDriver");
const subtituloPainelInsucessoDriver = document.getElementById("subtituloPainelInsucessoDriver");
const tagTotalDriversPainel = document.getElementById("tagTotalDriversPainel");
const tbodyInsucessoDriver = document.getElementById("tbodyInsucessoDriver");
const painelAtraso = document.getElementById("painelAtraso");
const btnFecharAtraso = document.getElementById("btnFecharAtraso");
const painelPendentes = document.getElementById("painelPendentes");
const btnFecharPendentes = document.getElementById("btnFecharPendentes");
const tagTotalPendentesResumo = document.getElementById("tagTotalPendentesResumo");
const tbodyPendentesResumo = document.getElementById("tbodyPendentesResumo");
const tbodyMotoristasDetalhe = document.getElementById("tbodyMotoristasDetalhe");
const tbodyCulpaCd = document.getElementById("tbodyCulpaCd");
const tagTotalMotoristas = document.getElementById("tagTotalMotoristas");
const tagTotalCd = document.getElementById("tagTotalCd");
const tbodyOutros = document.getElementById("tbodyOutros");
const tagTotalOutros = document.getElementById("tagTotalOutros");
const tbodyBaseDetalhe = document.getElementById("tbodyBaseDetalhe");
const baseDetalheTitulo = document.getElementById("baseDetalheTitulo");
const tagTotalBaseDetalhe = document.getElementById("tagTotalBaseDetalhe");
const baseDetalheSubtitulo = document.getElementById("baseDetalheSubtitulo");
const painelBaseDetalhe = document.getElementById("painelBaseDetalhe");
const btnFecharBaseDetalhe = document.getElementById("btnFecharBaseDetalhe");

let currentUF = String(ufSelect?.value || "RJ").toUpperCase();
let bars = [];
let chartData = [];
let detalhesAtraso = { motoristas: [], culpaCD: [], outros: [] };
let pendentesDetalhados = { naoRecebido: [], aguardando: [], processo: [] };
let resumoInsucessosPorDia = [];
let baseInsucessosDetalhados = [];
let diaSelecionadoInsucesso = "";
let nomenclaturaSelecionadaInsucesso = "";
const hasSwal = typeof window !== "undefined" && typeof window.Swal !== "undefined";

const PRIMARY = "#2563eb";
const TEXT = "#111827";
const MUTED = "#6b7280";
const GRID = "#e5e7eb";

function formatInt(v) {
  return Number(v || 0).toLocaleString("pt-BR");
}

function formatPercent(v) {
  return `${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDateTime(isoUtc) {
  if (!isoUtc) return "-";
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function motivoLabelGlobal(motivo) {
  const key = String(motivo || "").toUpperCase();
  switch (key) {
    case "ETIQUETADO_EM_ROTA_ATRASO":
      return "CD etiquetou/recebeu, mas liberou Em Rota fora do prazo (Transferencia -> Em Rota em atraso)";
    case "ETIQUETADO_SEM_ROTA":
      return "CD etiquetou/recebeu e o pedido não entrou em rota";
    case "TRATATIVA_FORA_PRAZO":
      return "Ocorrência que depende de tratativa e o CD não subiu a baixa de Ag Tratativa no próximo dia útil";
    case "SEM_AG_TRATATIVA":
      return "Ocorrência que depende de tratativa e o CD não subiu a baixa de Ag Tratativa";
    case "AJUSTADO_SEM_ROTA":
      return "Pedido ajustado e não entrou em rota no próximo dia útil";
    case "RECEBIDO_APOS_INSUCESSO":
      return "Após insucesso, voltou para a base e não saiu em nova rota";
    default:
      return motivo || "-";
  }
}

async function chamarApi(uf) {
  const res = await fetch(`/api/sla-final/v1/m2/${encodeURIComponent(String(uf || "RJ").toUpperCase())}`);
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

function exportarKpiXlsx() {
  const uf = String(document.getElementById("ufSelect")?.value || currentUF || "RJ").toUpperCase();
  window.location.href = `/api/sla-final/v1/m2/${encodeURIComponent(uf)}/xlsx`;
}

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  const padX = 26;
  const padTop = 18;
  const padBottom = 46;
  const chartW = W - padX * 2;
  const chartH = H - padTop - padBottom;

  ctx.clearRect(0, 0, W, H);
  bars = [];

  if (!chartData.length) return;

  const max = Math.max(...chartData.map((d) => Number(d.value) || 0), 1);

  ctx.save();
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + chartW, y);
    ctx.stroke();
  }
  ctx.restore();

  const gap = 14;
  const barW = (chartW - gap * (chartData.length - 1)) / chartData.length;

  chartData.forEach((d, i) => {
    const val = Number(d.value) || 0;
    const barH = (val / max) * (chartH - 6);
    const x = padX + i * (barW + gap);
    const y = padTop + chartH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, PRIMARY);
    grad.addColorStop(1, "rgba(37, 99, 235, 0.60)");

    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barW, barH, 12);
    ctx.fill();

    ctx.fillStyle = TEXT;
    ctx.font = "600 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(String(val), x + barW / 2, y - 8);

    ctx.fillStyle = MUTED;
    ctx.font = '12px "Space Mono", monospace';
    ctx.fillText(String(d.label), x + barW / 2, padTop + chartH + 24);

    bars.push({ x, y, w: barW, h: barH, label: d.label, value: val });
  });
}

function renderTabelaMotoristas(ranking) {
  const lista = Array.isArray(ranking) ? ranking : [];
  if (!lista.length) {
    tbodyMotoristas.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
    return;
  }

  tbodyMotoristas.innerHTML = lista
    .map(
      (item) =>
        `<tr><td>${item.motorista || "-"}</td><td>${formatInt(item.quantidade)}</td><td>${formatPercent(
          item.percentual
        )}</td></tr>`
    )
    .join("");
}

function renderTabelaSlaDia(metricas) {
  const lista = Array.isArray(metricas) ? metricas : [];
  if (!lista.length) {
    tbodySlaDia.innerHTML = '<tr><td colspan="6">Sem dados.</td></tr>';
    return;
  }

  tbodySlaDia.innerHTML = lista
    .map(
      (item) =>
        `<tr><td>${item.dataCadastro}</td><td>${formatInt(item.totalPedidos)}</td><td>${formatInt(
          item.emDia
        )}</td><td>${formatInt(item.atraso)}</td><td>${formatInt(item.pendente)}</td><td>${formatPercent(
          item.slaDiaPercentual
        )}</td></tr>`
    )
    .join("");
}

function toMsDataBr(dataBr) {
  const [dia, mes, ano] = String(dataBr || "").split("/").map(Number);
  if (!Number.isFinite(dia) || !Number.isFinite(mes) || !Number.isFinite(ano)) return -Infinity;
  return Date.UTC(ano, mes - 1, dia);
}

function listarDiasInsucesso() {
  const acumulado = (Array.isArray(resumoInsucessosPorDia) ? resumoInsucessosPorDia : []).reduce((acc, item) => {
    const dia = String(item?.dataInsucessoDia || "").trim();
    if (!dia) return acc;
    acc[dia] = (acc[dia] || 0) + Number(item?.quantidade || 0);
    return acc;
  }, {});

  return Object.entries(acumulado)
    .map(([dia, quantidade]) => ({ dia, quantidade }))
    .sort((a, b) => toMsDataBr(b.dia) - toMsDataBr(a.dia));
}

function abrirPainelInsucessoDia() {
  if (!painelInsucessoDia) return;
  painelInsucessoDia.classList.remove("hidden");
}

function fecharPainelInsucessoDia() {
  if (painelInsucessoDia) painelInsucessoDia.classList.add("hidden");
  if (painelInsucessoNomenclatura) painelInsucessoNomenclatura.classList.add("hidden");
  if (painelInsucessoDriver) painelInsucessoDriver.classList.add("hidden");
}

function abrirPainelInsucessoNomenclatura() {
  if (!painelInsucessoNomenclatura) return;
  painelInsucessoNomenclatura.classList.remove("hidden");
}

function fecharPainelInsucessoNomenclatura() {
  if (painelInsucessoNomenclatura) painelInsucessoNomenclatura.classList.add("hidden");
  if (painelInsucessoDriver) painelInsucessoDriver.classList.add("hidden");
}

function abrirPainelInsucessoDriver() {
  if (!painelInsucessoDriver) return;
  painelInsucessoDriver.classList.remove("hidden");
}

function fecharPainelInsucessoDriver() {
  if (!painelInsucessoDriver) return;
  painelInsucessoDriver.classList.add("hidden");
}

function renderTabelaInsucessosDiasCard() {
  if (!tbodyInsucessosDiasCard) return;

  const dias = listarDiasInsucesso();
  const total = dias.reduce((acc, item) => acc + item.quantidade, 0);
  if (!dias.length) {
    tbodyInsucessosDiasCard.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
    return;
  }

  tbodyInsucessosDiasCard.innerHTML = dias
    .slice(0, 8)
    .map((item) => {
      const percentualTotal = total > 0 ? (item.quantidade / total) * 100 : 0;
      return `<tr class="clickable-row" data-dia-insucesso-card="${encodeURIComponent(item.dia)}">
        <td>${item.dia}</td>
        <td>${formatInt(item.quantidade)}</td>
        <td>${formatPercent(percentualTotal)}</td>
      </tr>`;
    })
    .join("");

  tbodyInsucessosDiasCard.querySelectorAll(".clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      diaSelecionadoInsucesso = decodeURIComponent(row.getAttribute("data-dia-insucesso-card") || "");
      nomenclaturaSelecionadaInsucesso = "";
      renderPainelInsucessoNomenclatura();
      abrirPainelInsucessoNomenclatura();
    });
  });
}

function renderPainelInsucessoDia() {
  if (!tbodyInsucessoDia) return;

  const dias = listarDiasInsucesso();
  const total = dias.reduce((acc, item) => acc + item.quantidade, 0);
  if (tagTotalDiasInsucesso) tagTotalDiasInsucesso.textContent = formatInt(dias.length);

  if (!dias.length) {
    tbodyInsucessoDia.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
    return;
  }

  tbodyInsucessoDia.innerHTML = dias
    .map((item) => {
      const percentualTotal = total > 0 ? (item.quantidade / total) * 100 : 0;
      return `<tr class="clickable-row" data-dia-insucesso="${encodeURIComponent(item.dia)}">
        <td>${item.dia}</td>
        <td>${formatInt(item.quantidade)}</td>
        <td>${formatPercent(percentualTotal)}</td>
      </tr>`;
    })
    .join("");

  tbodyInsucessoDia.querySelectorAll(".clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      diaSelecionadoInsucesso = decodeURIComponent(row.getAttribute("data-dia-insucesso") || "");
      nomenclaturaSelecionadaInsucesso = "";
      renderPainelInsucessoNomenclatura();
      abrirPainelInsucessoNomenclatura();
    });
  });
}

function renderPainelInsucessoNomenclatura() {
  if (!tbodyInsucessoNomenclatura) return;

  const dia = String(diaSelecionadoInsucesso || "").trim();
  if (subtituloPainelInsucessoNomenclatura) {
    subtituloPainelInsucessoNomenclatura.textContent = `Dia selecionado: ${dia || "-"}`;
  }

  if (!dia) {
    if (tagTotalNomenclaturasPainel) tagTotalNomenclaturasPainel.textContent = "0";
    tbodyInsucessoNomenclatura.innerHTML = '<tr><td colspan="3">Selecione um dia.</td></tr>';
    return;
  }

  const lista = (Array.isArray(resumoInsucessosPorDia) ? resumoInsucessosPorDia : [])
    .filter((item) => String(item?.dataInsucessoDia || "") === dia)
    .map((item) => ({
      nomenclatura: item?.nomenclatura || "-",
      quantidade: Number(item?.quantidade || 0),
      percentualDia: Number(item?.percentualDia || 0),
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nomenclatura.localeCompare(b.nomenclatura, "pt-BR"));

  if (tagTotalNomenclaturasPainel) tagTotalNomenclaturasPainel.textContent = formatInt(lista.length);

  if (!lista.length) {
    tbodyInsucessoNomenclatura.innerHTML = '<tr><td colspan="3">Sem dados para o dia selecionado.</td></tr>';
    return;
  }

  tbodyInsucessoNomenclatura.innerHTML = lista
    .map(
      (item) => `<tr class="clickable-row" data-nomenclatura-insucesso="${encodeURIComponent(item.nomenclatura)}">
        <td>${item.nomenclatura}</td>
        <td>${formatInt(item.quantidade)}</td>
        <td>${formatPercent(item.percentualDia)}</td>
      </tr>`
    )
    .join("");

  tbodyInsucessoNomenclatura.querySelectorAll(".clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      nomenclaturaSelecionadaInsucesso = decodeURIComponent(
        row.getAttribute("data-nomenclatura-insucesso") || ""
      );
      renderPainelInsucessoDriver();
      abrirPainelInsucessoDriver();
    });
  });
}

function renderPainelInsucessoDriver() {
  if (!tbodyInsucessoDriver) return;

  const dia = String(diaSelecionadoInsucesso || "").trim();
  const nomenclatura = String(nomenclaturaSelecionadaInsucesso || "").trim();

  if (subtituloPainelInsucessoDriver) {
    subtituloPainelInsucessoDriver.textContent = `Dia: ${dia || "-"} | Nomenclatura: ${nomenclatura || "-"}`;
  }

  if (!dia || !nomenclatura) {
    if (tagTotalDriversPainel) tagTotalDriversPainel.textContent = "0";
    tbodyInsucessoDriver.innerHTML = '<tr><td colspan="3">Selecione uma nomenclatura.</td></tr>';
    return;
  }

  const base = (Array.isArray(baseInsucessosDetalhados) ? baseInsucessosDetalhados : []).filter(
    (item) =>
      String(item?.dataInsucessoDia || "") === dia && String(item?.nomenclatura || "") === nomenclatura
  );

  if (!base.length) {
    if (tagTotalDriversPainel) tagTotalDriversPainel.textContent = "0";
    tbodyInsucessoDriver.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
    return;
  }

  const contagem = base.reduce((acc, item) => {
    const motorista = String(item?.motorista || "").trim() || "Sem Motorista";
    acc[motorista] = (acc[motorista] || 0) + 1;
    return acc;
  }, {});

  const total = Object.values(contagem).reduce((acc, qtd) => acc + qtd, 0);
  if (tagTotalDriversPainel) tagTotalDriversPainel.textContent = formatInt(total);

  const ranking = Object.entries(contagem)
    .map(([motorista, quantidade]) => ({
      motorista,
      quantidade,
      percentual: total > 0 ? (quantidade / total) * 100 : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.motorista.localeCompare(b.motorista, "pt-BR"));

  tbodyInsucessoDriver.innerHTML = ranking
    .map(
      (item) => `<tr>
        <td>${item.motorista}</td>
        <td>${formatInt(item.quantidade)}</td>
        <td>${formatPercent(item.percentual)}</td>
      </tr>`
    )
    .join("");
}

function abrirFluxoInsucessos() {
  renderPainelInsucessoDia();
  abrirPainelInsucessoDia();
}

function getPedidoValue(item) {
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (item && typeof item === "object") return String(item.pedido || item.Pedido || "");
  return "";
}

function renderTabelaPendentes(basePendentes) {
  if (!tbodyPendentes) return;
  const lista = Array.isArray(basePendentes) ? basePendentes : [];
  if (!lista.length) {
    tbodyPendentes.innerHTML = "<tr><td>Sem dados.</td></tr>";
    return;
  }

  tbodyPendentes.innerHTML = lista
    .map((item) => `<tr><td>${getPedidoValue(item) || "-"}</td></tr>`)
    .join("");
}

function renderTabelaAtrasados(baseAtrasados) {
  if (!tbodyAtrasados) return;
  const lista = Array.isArray(baseAtrasados) ? baseAtrasados : [];
  if (!lista.length) {
    tbodyAtrasados.innerHTML = "<tr><td>Sem dados.</td></tr>";
    return;
  }

  tbodyAtrasados.innerHTML = lista
    .map((item) => `<tr><td>${getPedidoValue(item) || "-"}</td></tr>`)
    .join("");
}

function renderTabelaPendentesResumo() {
  if (!tbodyPendentesResumo) return;
  const naoRecebido = pendentesDetalhados.naoRecebido || [];
  const aguardando = pendentesDetalhados.aguardando || [];
  const processo = pendentesDetalhados.processo || [];

  const total = naoRecebido.length + aguardando.length + processo.length;
  if (tagTotalPendentesResumo) tagTotalPendentesResumo.textContent = formatInt(total);

  const rows = [
    { key: "NAO_RECEBIDO", label: "Não recebido", qtd: naoRecebido.length },
    { key: "AG_TRATATIVA", label: "Aguardando Tratativa", qtd: aguardando.length },
    { key: "PROCESSO", label: "Processo não seguido", qtd: processo.length },
  ];

  if (!total) {
    tbodyPendentesResumo.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
    return;
  }

  tbodyPendentesResumo.innerHTML = rows
    .map((item) => {
      const pct = total > 0 ? (item.qtd / total) * 100 : 0;
      return `<tr class="clickable-row" data-pendente-motivo="${item.key}">
        <td>${item.label}</td>
        <td>${formatInt(item.qtd)}</td>
        <td>${formatPercent(pct)}</td>
      </tr>`;
    })
    .join("");

  tbodyPendentesResumo.querySelectorAll(".clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      const motivo = row.getAttribute("data-pendente-motivo") || "";
      mostrarBasePendentesMotivo(motivo);
    });
  });
}

function renderTabelaMotoristasDetalhe(lista) {
  if (!tbodyMotoristasDetalhe) return;
  const dados = Array.isArray(lista) ? lista : [];
  if (!dados.length) {
    tbodyMotoristasDetalhe.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
    if (tagTotalMotoristas) tagTotalMotoristas.textContent = "0";
    return;
  }

  const contagem = dados.reduce((acc, item) => {
    const nome = String(item.motorista || "").trim() || "Não informado";
    acc[nome] = (acc[nome] || 0) + 1;
    return acc;
  }, {});

  const total = Object.values(contagem).reduce((acc, v) => acc + v, 0);
  if (tagTotalMotoristas) tagTotalMotoristas.textContent = formatInt(total);

  const ranking = Object.entries(contagem)
    .map(([motorista, quantidade]) => ({
      motorista,
      quantidade,
      percentual: total > 0 ? (quantidade / total) * 100 : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.motorista.localeCompare(b.motorista, "pt-BR"));

  tbodyMotoristasDetalhe.innerHTML = ranking
    .map(
      (item) =>
        `<tr class="clickable-row" data-motorista="${encodeURIComponent(item.motorista || "")}">
          <td>${item.motorista || "-"}</td>
          <td>${formatInt(item.quantidade)}</td>
          <td>${formatPercent(item.percentual)}</td>
        </tr>`
    )
    .join("");

  tbodyMotoristasDetalhe.querySelectorAll(".clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      const motorista = decodeURIComponent(row.getAttribute("data-motorista") || "");
      mostrarBasePorMotorista(motorista);
    });
  });
}

function renderTabelaCulpaCd(lista) {
  if (!tbodyCulpaCd) return;
  const dados = Array.isArray(lista) ? lista : [];
  if (!dados.length) {
    tbodyCulpaCd.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
    if (tagTotalCd) tagTotalCd.textContent = "0";
    return;
  }

  const motivoLabel = motivoLabelGlobal;

  const contagem = dados.reduce((acc, item) => {
    const motivo = motivoLabel(item.motivo);
    acc[motivo] = (acc[motivo] || 0) + 1;
    return acc;
  }, {});

  const total = Object.values(contagem).reduce((acc, v) => acc + v, 0);
  if (tagTotalCd) tagTotalCd.textContent = formatInt(total);

  const ranking = Object.entries(contagem)
    .map(([motivo, quantidade]) => ({
      motivo,
      quantidade,
      percentual: total > 0 ? (quantidade / total) * 100 : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.motivo.localeCompare(b.motivo, "pt-BR"));

  tbodyCulpaCd.innerHTML = ranking
    .map(
      (item) =>
        `<tr class="clickable-row" data-motivo="${encodeURIComponent(item.motivo || "")}">
          <td>${item.motivo || "-"}</td>
          <td>${formatInt(item.quantidade)}</td>
          <td>${formatPercent(item.percentual)}</td>
        </tr>`
    )
    .join("");

  tbodyCulpaCd.querySelectorAll(".clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      const motivo = decodeURIComponent(row.getAttribute("data-motivo") || "");
      mostrarBasePorMotivo(motivo);
    });
  });
}

function renderTabelaOutros(lista) {
  if (!tbodyOutros) return;
  const dados = Array.isArray(lista) ? lista : [];
  if (!dados.length) {
    tbodyOutros.innerHTML = "<tr><td>Sem dados.</td></tr>";
    if (tagTotalOutros) tagTotalOutros.textContent = "0";
    return;
  }

  if (tagTotalOutros) tagTotalOutros.textContent = formatInt(dados.length);
  tbodyOutros.innerHTML = dados.map((item) => `<tr><td>${getPedidoValue(item) || "-"}</td></tr>`).join("");
}

function limparBaseDetalhe() {
  if (baseDetalheTitulo) baseDetalheTitulo.textContent = "Base de pedidos";
  if (baseDetalheSubtitulo) baseDetalheSubtitulo.textContent = "Seleção";
  if (tagTotalBaseDetalhe) tagTotalBaseDetalhe.textContent = "0";
  if (tbodyBaseDetalhe) {
    tbodyBaseDetalhe.innerHTML = '<tr><td colspan="2">Clique em um motorista ou motivo para ver os pedidos.</td></tr>';
  }
}

function abrirBaseDetalhe() {
  if (!painelBaseDetalhe) return;
  painelBaseDetalhe.classList.remove("hidden");
}

function fecharBaseDetalhe() {
  if (!painelBaseDetalhe) return;
  painelBaseDetalhe.classList.add("hidden");
}

function mostrarBasePorMotorista(motorista) {
  const lista = (detalhesAtraso.motoristas || []).filter(
    (item) => String(item.motorista || "").trim() === String(motorista || "").trim()
  );
  if (baseDetalheTitulo) baseDetalheTitulo.textContent = `Base de pedidos - Motorista: ${motorista || "-"}`;
  if (baseDetalheSubtitulo) baseDetalheSubtitulo.textContent = "Drivers ofensores";
  if (tagTotalBaseDetalhe) tagTotalBaseDetalhe.textContent = formatInt(lista.length);
  if (!tbodyBaseDetalhe) return;

  tbodyBaseDetalhe.innerHTML = lista.length
    ? lista.map((item) => `<tr><td>${item.pedido || "-"}</td><td>Motorista</td></tr>`).join("")
    : '<tr><td colspan="2">Sem dados.</td></tr>';
  abrirBaseDetalhe();
}

function mostrarBasePorMotivo(motivo) {
  const lista = (detalhesAtraso.culpaCD || []).filter(
    (item) => motivoLabelGlobal(item.motivo) === motivo
  );
  if (baseDetalheTitulo) baseDetalheTitulo.textContent = `Base de pedidos - Motivo: ${motivo || "-"}`;
  if (baseDetalheSubtitulo) baseDetalheSubtitulo.textContent = "Falha do CD";
  if (tagTotalBaseDetalhe) tagTotalBaseDetalhe.textContent = formatInt(lista.length);
  if (!tbodyBaseDetalhe) return;

  tbodyBaseDetalhe.innerHTML = lista.length
    ? lista.map((item) => `<tr><td>${item.pedido || "-"}</td><td>Falha do CD</td></tr>`).join("")
    : '<tr><td colspan="2">Sem dados.</td></tr>';
  abrirBaseDetalhe();
}

function mostrarBasePendentesMotivo(motivo) {
  let lista = [];
  let label = "Pendentes";

  if (motivo === "NAO_RECEBIDO") {
    lista = pendentesDetalhados.naoRecebido || [];
    label = "Não recebido";
  } else if (motivo === "AG_TRATATIVA") {
    lista = pendentesDetalhados.aguardando || [];
    label = "Aguardando Tratativa";
  } else if (motivo === "PROCESSO") {
    lista = pendentesDetalhados.processo || [];
    label = "Processo não seguido";
  }

  if (baseDetalheTitulo) baseDetalheTitulo.textContent = `Base de pedidos - ${label}`;
  if (baseDetalheSubtitulo) baseDetalheSubtitulo.textContent = "Pendentes";
  if (tagTotalBaseDetalhe) tagTotalBaseDetalhe.textContent = formatInt(lista.length);
  if (!tbodyBaseDetalhe) return;

  tbodyBaseDetalhe.innerHTML = lista.length
    ? lista.map((item) => `<tr><td>${getPedidoValue(item) || "-"}</td><td>Pendente</td></tr>`).join("")
    : '<tr><td colspan="2">Sem dados.</td></tr>';
  abrirBaseDetalhe();
}

function atualizarTela(payload) {
  const resumo = payload?.dadosOrganizados?.resumo || payload;
  const metricas = payload?.dadosOrganizados?.slaPorDataCadastro || payload?.metricasPorDataCadastro || [];
  const ranking = payload?.dadosOrganizados?.rankingMotoristasAtraso || payload?.rankingMotoristasAtraso || [];
  const insucessosResumo =
    payload?.dadosOrganizados?.insucessos?.resumoPorDia || payload?.resumoInsucessosPorDia || [];
  const insucessosDetalhadosPayload =
    payload?.dadosOrganizados?.insucessos?.detalhes || payload?.baseInsucessosDetalhados || [];
  const basePendentes =
    payload?.dadosOrganizados?.bases?.pendentes || payload?.basePedidosPendentes || payload?.basePendentes || [];
  const pendentesNaoRecebido =
    payload?.dadosOrganizados?.bases?.pendentesNaoRecebido || payload?.basePendentesNaoRecebido || [];
  const pendentesAguardandoTratativa =
    payload?.dadosOrganizados?.bases?.pendentesAguardandoTratativa || payload?.basePendentesAguardandoTratativa || [];
  const pendentesProcessoNaoSeguido =
    payload?.dadosOrganizados?.bases?.pendentesProcessoNaoSeguido || payload?.basePendentesProcessoNaoSeguido || [];
  const baseAtrasados =
    payload?.dadosOrganizados?.bases?.atrasados || payload?.basePedidosAtrasados || payload?.baseAtrasados || [];
  detalhesAtraso =
    payload?.dadosOrganizados?.detalhesAtraso || payload?.detalhesAtraso || { motoristas: [], culpaCD: [], outros: [] };

  const totalDePedidos = Number(resumo?.totalDePedidos || payload?.totalDePedidos || 0);
  const totalEmDia = Number(resumo?.totalEmDia || payload?.totalEmDia || 0);
  const totalAtrasados = Number(resumo?.totalAtrasados || payload?.totalAtrasados || 0);
  const totalPendentes = Number(resumo?.totalPendentes || payload?.totalPendentes || 0);
  const slaGeralPercentual = Number(resumo?.slaGeralPercentual || payload?.slaGeralPercentual || 0);
  const mediaSlaPorDiaPercentual = Number(
    resumo?.mediaSlaPorDiaPercentual || payload?.mediaSlaPorDiaPercentual || 0
  );
  const totalAtrasosOcasionadosPorMotoristas = Number(
    resumo?.totalAtrasosOcasionadosPorMotoristas || payload?.totalAtrasosOcasionadosPorMotoristas || 0
  );
  const totalInsucessos = Number(
    resumo?.totalInsucessos || payload?.totalInsucessos || insucessosDetalhadosPayload.length || 0
  );

  pendentesDetalhados = {
    naoRecebido: pendentesNaoRecebido,
    aguardando: pendentesAguardandoTratativa,
    processo: pendentesProcessoNaoSeguido,
    todos: basePendentes,
  };
  resumoInsucessosPorDia = insucessosResumo;
  baseInsucessosDetalhados = insucessosDetalhadosPayload;
  if (!listarDiasInsucesso().some((item) => item.dia === diaSelecionadoInsucesso)) {
    diaSelecionadoInsucesso = "";
    nomenclaturaSelecionadaInsucesso = "";
  }

  elTotal.textContent = formatInt(totalDePedidos);
  elEmDia.textContent = formatInt(totalEmDia);
  elEmAtraso.textContent = formatInt(totalAtrasados);
  elPendentes.textContent = formatInt(totalPendentes);
  elSlaGeral.textContent = formatPercent(slaGeralPercentual);
  elMediaSlaDia.textContent = formatPercent(mediaSlaPorDiaPercentual);
  if (elAtrasosMotorista) elAtrasosMotorista.textContent = formatInt(totalAtrasosOcasionadosPorMotoristas);
  if (elPendentesCard) elPendentesCard.textContent = formatInt(totalPendentes);
  if (elAtrasadosCard) elAtrasadosCard.textContent = formatInt(totalAtrasados);
  if (elInsucessosCard) elInsucessosCard.textContent = formatInt(totalInsucessos);

  chartData = [
    { label: "Em Dia", value: totalEmDia },
    { label: "Atraso", value: totalAtrasados },
    { label: "Pendente", value: totalPendentes },
  ];
  draw();
  renderTabelaMotoristas(ranking);
  renderTabelaSlaDia(metricas);
  renderTabelaInsucessosDiasCard();
  renderTabelaPendentes(basePendentes);
  renderTabelaAtrasados(baseAtrasados);
  renderTabelaPendentesResumo();
  renderTabelaMotoristasDetalhe(detalhesAtraso.motoristas);
  renderTabelaCulpaCd(detalhesAtraso.culpaCD);
  renderTabelaOutros(detalhesAtraso.outros);
  fecharPainelInsucessoDia();
  limparBaseDetalhe();
}

async function carregarPainel(uf) {
  if (hasSwal) {
    Swal.fire({
      title: "Carregando painel...",
      html: `Buscando dados (${String(uf).toUpperCase()})`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });
  }

  try {
    const payload = await chamarApi(uf);
    atualizarTela(payload);
    if (hasSwal) Swal.close();
  } catch (err) {
    if (hasSwal) {
      Swal.fire({
        icon: "error",
        title: "Erro ao carregar painel",
        text: err?.message || "Não foi possível carregar os dados.",
      });
    } else {
      console.error("Erro ao carregar painel:", err?.message || err);
      elTotal.textContent = "-";
      elEmDia.textContent = "-";
      elEmAtraso.textContent = "-";
      elPendentes.textContent = "-";
      elSlaGeral.textContent = "-";
      elMediaSlaDia.textContent = "-";
      if (elInsucessosCard) elInsucessosCard.textContent = "-";
    }
  }
}

function onMove(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const hit = bars.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
  if (!hit) {
    tooltip.style.opacity = 0;
    canvas.style.cursor = "default";
    return;
  }
  canvas.style.cursor = "pointer";
  tooltip.style.opacity = 1;
  tooltip.style.left = `${hit.x + hit.w / 2}px`;
  tooltip.style.top = `${hit.y}px`;
  tooltip.innerHTML = `<strong>${hit.label}</strong><small>${formatInt(hit.value)} pedidos</small>`;
}

function onLeave() {
  tooltip.style.opacity = 0;
  canvas.style.cursor = "default";
}

function abrirPainelAtraso() {
  if (!painelAtraso) return;
  painelAtraso.classList.remove("hidden");
}

function fecharPainelAtraso() {
  if (!painelAtraso) return;
  painelAtraso.classList.add("hidden");
}

function abrirPainelPendentes() {
  if (!painelPendentes) return;
  painelPendentes.classList.remove("hidden");
}

function fecharPainelPendentes() {
  if (!painelPendentes) return;
  painelPendentes.classList.add("hidden");
}

function onClick(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const hit = bars.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
  if (!hit) return;

  const label = String(hit.label || "").toLowerCase();
  if (label === "atraso") abrirPainelAtraso();
  if (label === "pendente" || label === "pendentes") abrirPainelPendentes();
}

function init() {
  fitCanvas();
  carregarPainel(currentUF);

  ufSelect?.addEventListener("change", () => {
    currentUF = String(ufSelect.value || "RJ").toUpperCase();
    carregarPainel(currentUF);
  });

  window.addEventListener("resize", () => {
    fitCanvas();
    draw();
  });

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
  canvas.addEventListener("click", onClick);

  btnFecharAtraso?.addEventListener("click", fecharPainelAtraso);
  painelAtraso?.addEventListener("click", (e) => {
    if (e.target?.dataset?.close) fecharPainelAtraso();
  });
  if (cardPendentes) {
    cardPendentes.addEventListener("click", () => {
      abrirPainelPendentes();
    });
  }
  btnAbrirPainelInsucessoDia?.addEventListener("click", abrirFluxoInsucessos);
  btnFecharInsucessoDia?.addEventListener("click", fecharPainelInsucessoDia);
  painelInsucessoDia?.addEventListener("click", (e) => {
    if (e.target?.dataset?.closeInsucessoDia) fecharPainelInsucessoDia();
  });
  btnFecharInsucessoNomenclatura?.addEventListener("click", fecharPainelInsucessoNomenclatura);
  painelInsucessoNomenclatura?.addEventListener("click", (e) => {
    if (e.target?.dataset?.closeInsucessoNomenclatura) fecharPainelInsucessoNomenclatura();
  });
  btnFecharInsucessoDriver?.addEventListener("click", fecharPainelInsucessoDriver);
  painelInsucessoDriver?.addEventListener("click", (e) => {
    if (e.target?.dataset?.closeInsucessoDriver) fecharPainelInsucessoDriver();
  });
  btnFecharPendentes?.addEventListener("click", fecharPainelPendentes);
  painelPendentes?.addEventListener("click", (e) => {
    if (e.target?.dataset?.close) fecharPainelPendentes();
  });
  btnFecharBaseDetalhe?.addEventListener("click", fecharBaseDetalhe);
  painelBaseDetalhe?.addEventListener("click", (e) => {
    if (e.target?.dataset?.closeDetail) fecharBaseDetalhe();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      fecharPainelAtraso();
      fecharPainelPendentes();
      fecharPainelInsucessoDriver();
      fecharPainelInsucessoNomenclatura();
      fecharPainelInsucessoDia();
    }
  });
}

window.exportarKpiXlsx = exportarKpiXlsx;
init();

