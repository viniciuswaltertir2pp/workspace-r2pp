document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("arquivo");
  const box = document.getElementById("uploader");
  const uploadUrl = "/api/last-mile/upload";

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

  ["dragenter", "dragover"].forEach((evt) =>
    box.addEventListener(
      evt,
      (event) => {
        event.preventDefault();
        box.style.borderColor = "rgba(99,102,241,0.9)";
      },
      false
    )
  );

  ["dragleave", "drop"].forEach((evt) =>
    box.addEventListener(
      evt,
      (event) => {
        event.preventDefault();
        box.style.borderColor = "rgba(255,255,255,0.2)";
      },
      false
    )
  );

  box.addEventListener("drop", async (event) => {
    event.preventDefault();

    const file = event.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith(".xlsx")) {
      await enviarArquivo(file);
      return;
    }

    Swal.fire("Formato invalido", "Envie um arquivo .xlsx", "warning");
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
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Falha no upload");
      }

      box.classList.remove("is-uploading");
      box.classList.add("is-success");

      Swal.fire("Sucesso", "Upload realizado com sucesso", "success");

      setTimeout(() => box.classList.remove("is-success"), 1800);
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error(error);
      box.classList.remove("is-uploading");
      box.classList.add("is-error");

      Swal.fire("Erro", "Nao foi possivel enviar a planilha.", "error");
      setTimeout(() => box.classList.remove("is-error"), 1800);
    }
  }
});