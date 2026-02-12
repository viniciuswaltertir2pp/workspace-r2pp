document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("arquivo");
  const box = document.getElementById("uploader");
  const UPLOAD_URL = "/api/sla-final/upload";

  if (!input || !box) return;

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
    box.addEventListener(evt, (e) => {
      e.preventDefault();
      box.style.borderColor = "rgba(99,102,241,0.9)";
    })
  );

  ["dragleave", "drop"].forEach((evt) =>
    box.addEventListener(evt, (e) => {
      e.preventDefault();
      box.style.borderColor = "rgba(255,255,255,0.2)";
    })
  );

  box.addEventListener("drop", async (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith(".xlsx")) await enviarArquivo(file);
    else Swal.fire("Formato invalido", "Envie um arquivo .xlsx", "warning");
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
      const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Falha no upload");

      box.classList.remove("is-uploading");
      box.classList.add("is-success");
      Swal.fire("Sucesso!", "Upload realizado com sucesso", "success");
      setTimeout(() => box.classList.remove("is-success"), 1800);
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      box.classList.remove("is-uploading");
      box.classList.add("is-error");
      Swal.fire("Erro!", "Nao foi possivel enviar a planilha.", "error");
      setTimeout(() => box.classList.remove("is-error"), 1800);
    }
  }
});
