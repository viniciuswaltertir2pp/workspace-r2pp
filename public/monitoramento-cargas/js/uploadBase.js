document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("arquivo");
  const box = document.getElementById("uploader");
  const uploadUrl = "/api/monitoramento-cargas/upload";

  if (!input || !box) {
    console.error("Elemento #arquivo ou #uploader nao encontrado no DOM.");
    return;
  }

  input.addEventListener("change", async () => {
    if (!input.files.length) return;

    const file = input.files[0];

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      Swal.fire("Formato invalido", "Envie um arquivo .xlsx", "warning");
      input.value = "";
      return;
    }

    await enviarArquivo(file);
    input.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    box.addEventListener(
      eventName,
      (event) => {
        event.preventDefault();
        box.classList.add("is-dragover");
      },
      false
    );
  });

  ["dragleave", "drop"].forEach((eventName) => {
    box.addEventListener(
      eventName,
      (event) => {
        event.preventDefault();
        box.classList.remove("is-dragover");
      },
      false
    );
  });

  box.addEventListener("drop", async (event) => {
    event.preventDefault();

    const file = event.dataTransfer.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".xlsx")) {
      Swal.fire("Formato invalido", "Envie um arquivo .xlsx", "warning");
      return;
    }

    await enviarArquivo(file);
  });

  async function enviarArquivo(file) {
    const formData = new FormData();
    formData.append("arquivo", file);

    box.classList.add("is-uploading");
    Swal.fire({
      title: "Enviando...",
      text: "Atualizando sua planilha",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const resposta = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!resposta.ok) {
        throw new Error(`Falha no upload (${resposta.status})`);
      }

      box.classList.remove("is-uploading");
      box.classList.add("is-success");

      Swal.fire("Sucesso!", "Upload realizado com sucesso", "success");

      setTimeout(() => box.classList.remove("is-success"), 1800);
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error(error);
      box.classList.remove("is-uploading");
      box.classList.add("is-error");

      Swal.fire("Erro!", "Nao foi possivel enviar a planilha.", "error");
      setTimeout(() => box.classList.remove("is-error"), 1800);
    }
  }
});
