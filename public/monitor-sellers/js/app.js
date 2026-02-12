const fileInput = document.getElementById("fileInput");
const uploader = document.getElementById("uploader");
const sellerSearch = document.getElementById("sellerSearch");
const statusFilter = document.getElementById("statusFilter");
const driverFilter = document.getElementById("driverFilter");
const cards = document.getElementById("cards");
const statusEl = document.getElementById("status");
const sellerCounter = document.getElementById("sellerCounter");
const sellerCollectedCount = document.getElementById("sellerCollectedCount");
const sellerPendingCount = document.getElementById("sellerPendingCount");

const URL_BUSCAR_BASE = "/api/monitor-sellers/buscar-base";
const URL_UPLOAD = "/api/monitor-sellers/upload";

let allItems = [];

const setStatus = (text) => {
  if (statusEl) {
    statusEl.textContent = text;
  }
};

const updateSellerCounter = () => {
  if (!sellerCounter) return;

  const coletados = allItems.filter((item) => item?.jaFoiColetado).length;
  const pendentes = allItems.filter((item) => !item?.jaFoiColetado).length;

  if (sellerCollectedCount) sellerCollectedCount.textContent = String(coletados);
  if (sellerPendingCount) sellerPendingCount.textContent = String(pendentes);

  sellerCounter.title = `Sellers coletados / pendentes: ${coletados} / ${pendentes}`;
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const render = (items) => {
  const sorted = [...items].sort(
    (a, b) => b.pedidosFaltandoColeta - a.pedidosFaltandoColeta
  );

  if (!cards) return;

  if (!sorted.length) {
    cards.innerHTML = '<article class="card"><small>Nenhum seller encontrado.</small></article>';
    return;
  }

  cards.innerHTML = sorted
    .map((item) => {
      const badgeClass = item.jaFoiColetado ? "ok" : "warn";
      const badgeText = item.jaFoiColetado ? "Coletado" : "Pendente";
      const motoristas = item.motoristasNaoColetados.length
        ? item.motoristasNaoColetados.join(", ")
        : "Sem motorista pendente";

      return `
        <article class="card">
          <strong>${item.seller}</strong><br>
          <small>Pedidos faltando coleta: ${item.pedidosFaltandoColeta}</small><br>
          <small>Motoristas: ${motoristas}</small><br>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </article>
      `;
    })
    .join("");
};

const buildDriverOptions = () => {
  if (!driverFilter) return;

  const currentValue = driverFilter.value;

  const drivers = [
    ...new Set(allItems.flatMap((item) => item.motoristasNaoColetados || [])),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  driverFilter.innerHTML = '<option value="all">Todos motoristas</option>';
  drivers.forEach((driver) => {
    const option = document.createElement("option");
    option.value = driver;
    option.textContent = driver;
    driverFilter.appendChild(option);
  });

  if ([...driverFilter.options].some((option) => option.value === currentValue)) {
    driverFilter.value = currentValue;
  }
};

const filterAndRender = () => {
  const term = normalizeText(sellerSearch?.value);
  const status = statusFilter?.value || "all";
  const selectedDriver = driverFilter?.value || "all";

  const filtered = allItems.filter((item) => {
    const matchesSeller = normalizeText(item.seller).includes(term);
    const matchesStatus =
      status === "all" ||
      (status === "pendente" && !item.jaFoiColetado) ||
      (status === "coletado" && item.jaFoiColetado);
    const matchesDriver =
      selectedDriver === "all" ||
      (item.motoristasNaoColetados || []).includes(selectedDriver);

    return matchesSeller && matchesStatus && matchesDriver;
  });

  render(filtered);
};

const loadResumo = async () => {
  try {
    setStatus("Carregando dados...");

    const response = await fetch(URL_BUSCAR_BASE, { method: "GET" });

    if (!response.ok) {
      let detalhe = "";
      try {
        const erro = await response.json();
        detalhe = erro.msg ? ` - ${erro.msg}` : "";
      } catch {
        detalhe = "";
      }
      throw new Error(`Falha ao consultar API (${response.status})${detalhe}`);
    }

    const data = await response.json();
    allItems = Array.isArray(data) ? data : [];

    updateSellerCounter();
    buildDriverOptions();
    filterAndRender();
    setStatus("");
  } catch (error) {
    allItems = [];
    updateSellerCounter();
    render([]);
    const detalhe = error instanceof Error ? error.message : "Falha ao carregar dados.";
    setStatus(detalhe);
  }
};

const uploadFile = async (file) => {
  if (!file) {
    setStatus("Selecione um arquivo .xlsx antes do upload.");
    return;
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
    setStatus("Formato invalido. Use .xlsx ou .xls.");
    return;
  }

  if (uploader) {
    uploader.classList.remove("is-success", "is-error");
    uploader.classList.add("is-uploading");
  }

  setStatus("Enviando planilha...");

  try {
    const formData = new FormData();
    formData.append("arquivo", file);

    const response = await fetch(URL_UPLOAD, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let detalhe = "";
      try {
        const erro = await response.json();
        detalhe = erro.msg ? ` - ${erro.msg}` : "";
      } catch {
        detalhe = "";
      }
      throw new Error(`Falha no upload (${response.status})${detalhe}`);
    }

    if (uploader) {
      uploader.classList.remove("is-uploading");
      uploader.classList.add("is-success");
    }

    setStatus("Upload concluido. Atualizando dados...");
    await loadResumo();
  } catch (error) {
    if (uploader) {
      uploader.classList.remove("is-uploading");
      uploader.classList.add("is-error");
    }

    const detalhe = error instanceof Error ? error.message : "Falha no upload da planilha.";
    setStatus(detalhe);
  }
};

if (uploader && fileInput) {
  uploader.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    uploadFile(fileInput.files?.[0]);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploader.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      setStatus("Solte o arquivo para enviar...");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploader.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });

  uploader.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    uploadFile(file);
  });
}

if (sellerSearch) sellerSearch.addEventListener("input", filterAndRender);
if (statusFilter) statusFilter.addEventListener("change", filterAndRender);
if (driverFilter) driverFilter.addEventListener("change", filterAndRender);

loadResumo();
