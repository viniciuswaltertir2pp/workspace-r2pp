async function carregarHtml2Canvas() {
  if (typeof window.html2canvas !== "undefined") return window.html2canvas;

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.html2canvas;
}

async function capturarMainSemPendentes() {
  const main = document.querySelector("main.page");
  const cardPendentes = document.getElementById("cardPendentes");
  const cardAtrasados = document.getElementById("cardAtrasados");
  const botao = document.getElementById("btnPrintMain");
  if (!main) return;

  const estadoDisplayOriginal = cardPendentes ? cardPendentes.style.display : "";
  const estadoDisplayAtrasadosOriginal = cardAtrasados ? cardAtrasados.style.display : "";
  const estadoBotaoOriginal = botao ? botao.disabled : false;

  try {
    if (botao) botao.disabled = true;
    if (cardPendentes) cardPendentes.style.display = "none";
    if (cardAtrasados) cardAtrasados.style.display = "none";

    const html2canvas = await carregarHtml2Canvas();
    const canvas = await html2canvas(main, {
      backgroundColor: "#f4f5f7",
      scale: 2,
      useCORS: true,
    });

    const link = document.createElement("a");
    const uf = String(document.getElementById("ufSelect")?.value || "UF").toUpperCase();
    link.download = `painel-sla-${uf}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    console.error("Falha ao capturar o painel:", error);
    if (typeof window.Swal !== "undefined") {
      Swal.fire("Erro", "Nao foi possivel capturar o painel agora.", "error");
    }
  } finally {
    if (cardPendentes) cardPendentes.style.display = estadoDisplayOriginal;
    if (cardAtrasados) cardAtrasados.style.display = estadoDisplayAtrasadosOriginal;
    if (botao) botao.disabled = estadoBotaoOriginal;
  }
}

window.capturarMainSemPendentes = capturarMainSemPendentes;
