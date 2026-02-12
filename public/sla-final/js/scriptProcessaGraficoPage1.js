// =========================
// UF (estado selecionado)
// =========================
const ufSelect = document.getElementById("ufSelect");
let currentUF = (ufSelect?.value || "rj").toLowerCase();

// =========================
// API
// =========================
async function chamarApi(uf = currentUF) {
  const ufParam = String(uf || "rj").trim().toLowerCase();
  const res = await fetch(`http://45.89.30.59:3030/v1/m2/${ufParam}`);

  // ✅ tratamento correto de erro HTTP
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      msg = errJson?.mensagem || errJson?.message || msg;
    } catch (_) {
      try { msg = await res.text(); } catch (_) {}
    }
    throw new Error(msg);
  }

  return await res.json(); // ✅ agora vem um OBJETO (totalPedidos, pedidosEmDia, etc.)
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let data = []; // array pro gráfico (Em Dia / Em Atraso / Pendentes)

const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("chartTooltip");

// ✅ spans dos KPIs (labels ficam no HTML, só valores mudam)
const elPercentual = document.getElementById("percentual");
const elTotal = document.getElementById("kpiTotal");
const elEmDia = document.getElementById("kpiEmDia");
const elEmAtraso = document.getElementById("kpiEmAtraso");
const elPendentes = document.getElementById("kpiPendentes");

const PRIMARY = "#2563eb";
const TEXT = "#111827";
const MUTED = "#6b7280";
const GRID = "#e5e7eb";

let bars = [];

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function atualizarKpis({ total, emDia, emAtraso, pendentes }) {


  let opPercentual = ((emDia / total) * 100).toFixed(0)

  elPercentual.textContent = `${opPercentual}%`;
  elTotal.textContent = String(total);
  elEmDia.textContent = String(emDia);
  elEmAtraso.textContent = String(emAtraso);
  elPendentes.textContent = String(pendentes);
}

// ---------- Normalização do retorno (NOVA API) ----------
function normalizeM2Payload(payload) {
  const total = Number(payload?.totalPedidos ?? 0) || 0;
  const emDia = Number(payload?.pedidosEmDia ?? 0) || 0;
  const emAtraso = Number(payload?.pedidosAtrasados ?? 0) || 0;

  // pode vir tanto "pedidosPendentes" quanto basePendentes
  const pendentes =
    Number(payload?.pedidosPendentes ?? payload?.pedidosPendentes ?? 0) ||
    (Array.isArray(payload?.basePendentes) ? payload.basePendentes.length : 0);

  const basePendentes = Array.isArray(payload?.basePendentes) ? payload.basePendentes : [];
  const baseEmDia = Array.isArray(payload?.baseEmDia) ? payload.baseEmDia : [];
  const baseAtrasados = Array.isArray(payload?.baseAtrasados) ? payload.baseAtrasados : [];

  return { total, emDia, emAtraso, pendentes, basePendentes, baseEmDia, baseAtrasados };
}

// ---------- Desenho do gráfico ----------
function draw() {
  const rect = canvas.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  ctx.clearRect(0, 0, W, H);

  const padX = 26;
  const padTop = 18;
  const padBottom = 46;

  const chartW = W - padX * 2;
  const chartH = H - padTop - padBottom;

  if (!Array.isArray(data) || data.length === 0) {
    ctx.save();
    ctx.fillStyle = MUTED;
    ctx.font = "600 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados para exibir", W / 2, H / 2);
    ctx.restore();
    bars = [];
    return;
  }

  const max = Math.max(...data.map((d) => Number(d.value) || 0), 1);

  // grid horizontal
  ctx.save();
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  const lines = 4;
  for (let i = 0; i <= lines; i++) {
    const y = padTop + (chartH / lines) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + chartW, y);
    ctx.stroke();
  }
  ctx.restore();

  const gap = 14;
  const barW = (chartW - gap * (data.length - 1)) / data.length;

  bars = [];

  data.forEach((d, i) => {
    const val = Number(d.value) || 0;
    const barH = (val / max) * (chartH - 6);

    const x = padX + i * (barW + gap);
    const y = padTop + chartH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, PRIMARY);
    grad.addColorStop(1, "rgba(37, 99, 235, 0.60)");

    ctx.save();
    ctx.shadowColor = "rgba(37, 99, 235, 0.18)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barW, barH, 12);
    ctx.fill();
    ctx.restore();

    // valor em cima
    ctx.save();
    ctx.fillStyle = TEXT;
    ctx.font = "600 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(String(val), x + barW / 2, y - 8);
    ctx.restore();

    // label embaixo
    ctx.save();
    ctx.fillStyle = MUTED;
    ctx.font = '12px "Space Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(String(d.label), x + barW / 2, padTop + chartH + 24);
    ctx.restore();

    bars.push({ x, y, w: barW, h: barH, label: d.label, value: val });
  });
}

function hitTest(mx, my) {
  return bars.find(
    (b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h
  );
}

function onMove(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const hit = hitTest(mx, my);
  if (!hit) {
    tooltip.style.opacity = 0;
    canvas.style.cursor = "default";
    return;
  }

  canvas.style.cursor = "pointer";
  tooltip.style.opacity = 1;
  tooltip.style.left = `${hit.x + hit.w / 2}px`;
  tooltip.style.top = `${hit.y}px`;
  tooltip.innerHTML = `<strong>${hit.label}</strong><small>${hit.value} pedidos</small>`;
}

function onLeave() {
  tooltip.style.opacity = 0;
  canvas.style.cursor = "default";
}

// =========================
// Carregar painel (reutilizável)
// =========================
async function carregarPainel(uf = currentUF) {
  const startedAt = Date.now();

  Swal.fire({
    title: "Carregando painel...",
    html: `Buscando dados (${String(uf).toUpperCase()})`,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    fitCanvas();

    const payload = await chamarApi(uf);
    const { total, emDia, emAtraso, pendentes } = normalizeM2Payload(payload);

    atualizarKpis({ total, emDia, emAtraso, pendentes });

    data = [
      { label: "Em Dia", value: emDia },
      { label: "Em Atraso", value: emAtraso },
      { label: "Pendentes", value: pendentes },
    ];

    draw();

    const elapsed = Date.now() - startedAt;
    if (elapsed < 300) await wait(300 - elapsed);

    Swal.close();
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Erro ao carregar painel",
      text: err?.message ?? "Não foi possível carregar os dados.",
    });
  }
}

// =========================
// INIT
// =========================
function init() {
  if (ufSelect) {
    ufSelect.value = currentUF;

    ufSelect.addEventListener("change", () => {
      currentUF = (ufSelect.value || "rj").toLowerCase();
      carregarPainel(currentUF);
    });
  }

  carregarPainel(currentUF);
}

// =========================
// Helpers de lista (modal)
// =========================
function asPedidoString(x) {
  if (typeof x === "string" || typeof x === "number") return String(x);
  if (x && typeof x === "object") return String(x.pedido ?? x.Pedido ?? "");
  return "";
}

function renderListHtml(items, limit = 300) {
  const arr = Array.isArray(items) ? items : [];
  const sliced = arr.slice(0, limit);

  const lis = sliced
    .map((i) => {
      if (i && typeof i === "object" && !Array.isArray(i)) {
        const pedido = asPedidoString(i) || "(sem pedido)";
        const inicio = i.inicioOcorrencia ?? "";
        const ini = i.dataInicial ?? "";
        const fim = i.dataFinal ?? "";
        const extra =
          inicio || ini || fim
            ? ` <small style="color:#6b7280;display:block;margin-top:2px;">
                ${inicio ? `Início: ${inicio} — ` : ""}${ini ? `Ini: ${ini} — ` : ""}${fim ? `Fim: ${fim}` : ""}
              </small>`
            : "";
        return `<li><strong>${pedido}</strong>${extra}</li>`;
      }

      const pedido = asPedidoString(i);
      return `<li>${pedido || "(vazio)"}</li>`;
    })
    .join("");

  const more = arr.length > limit
    ? `<div style="margin-top:10px;color:#6b7280;font-size:12px;">
         Mostrando ${limit} de ${arr.length}. (limite para não travar o navegador)
       </div>`
    : "";

  return arr.length
    ? `<div style="max-height:55vh;overflow:auto;padding-right:6px;">
         <ul style="text-align:left;margin:0;padding-left:18px;">${lis}</ul>
       </div>${more}`
    : "Nenhum item.";
}

function getPendentesExplodidos(payload) {
  const bases = payload?.dadosOrganizados?.bases || {};
  const naoRecebido = payload?.basePendentesNaoRecebido || bases?.pendentesNaoRecebido || [];
  const aguardando = payload?.basePendentesAguardandoTratativa || bases?.pendentesAguardandoTratativa || [];
  const processo = payload?.basePendentesProcessoNaoSeguido || bases?.pendentesProcessoNaoSeguido || [];
  return { naoRecebido, aguardando, processo };
}

function renderPendentesExplodidos({ naoRecebido, aguardando, processo }) {
  const total =
    (Array.isArray(naoRecebido) ? naoRecebido.length : 0) +
    (Array.isArray(aguardando) ? aguardando.length : 0) +
    (Array.isArray(processo) ? processo.length : 0);

  return `
    <div style="text-align:left;">
      <div style="color:#6b7280;font-size:12px;margin-bottom:8px;">Total pendentes: ${total}</div>
      <div style="margin-bottom:14px;">
        <strong>Nao recebido (sem etiquetado) — ${Array.isArray(naoRecebido) ? naoRecebido.length : 0}</strong>
        ${renderListHtml(naoRecebido, 200)}
      </div>
      <div style="margin-bottom:14px;">
        <strong>Aguardando Tratativa (sem tratado) — ${Array.isArray(aguardando) ? aguardando.length : 0}</strong>
        ${renderListHtml(aguardando, 200)}
      </div>
      <div>
        <strong>Processo nao seguido (etiquetado sem baixa de Em Rota) — ${Array.isArray(processo) ? processo.length : 0}</strong>
        ${renderListHtml(processo, 200)}
      </div>
    </div>
  `;
}

// =========================
// Modais de listas (com loading)
// =========================
async function pendente() {
  Swal.fire({
    title: "Carregando...",
    html: "Buscando pedidos pendentes",
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const payload = await chamarApi(currentUF);
    const { basePendentes } = normalizeM2Payload(payload);
    const detalhamento = getPendentesExplodidos(payload);
    const temDetalhamento =
      (detalhamento.naoRecebido || []).length ||
      (detalhamento.aguardando || []).length ||
      (detalhamento.processo || []).length;

    Swal.fire({
      icon: "info",
      title: `Pedidos Pendentes (${currentUF.toUpperCase()})`,
      html: temDetalhamento ? renderPendentesExplodidos(detalhamento) : renderListHtml(basePendentes),
    });
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Erro ao buscar pendentes",
      text: err?.message ?? "Tente novamente.",
    });
  }
}

async function atraso() {
  Swal.fire({
    title: "Carregando...",
    html: "Buscando pedidos em atraso",
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const payload = await chamarApi(currentUF);
    const { baseAtrasados } = normalizeM2Payload(payload);

    Swal.fire({
      icon: "info",
      title: `Pedidos em Atraso (${currentUF.toUpperCase()})`,
      html: renderListHtml(baseAtrasados),
    });
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Erro ao buscar atrasados",
      text: err?.message ?? "Tente novamente.",
    });
  }
}

// =========================
// Eventos
// =========================
window.addEventListener("resize", () => {
  fitCanvas();
  draw();
});

canvas.addEventListener("mousemove", onMove);
canvas.addEventListener("mouseleave", onLeave);

// start
init();
