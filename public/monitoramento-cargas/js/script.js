const { createApp } = Vue;

createApp({
  data() {
    return {
      base: [],
      baseOriginal: [],
    };
  },
  methods: {
    async chamaApi() {
      try {
        const resposta = await fetch("/api/monitoramento-cargas/processa-base", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!resposta.ok) {
          throw new Error(`Falha ao consultar API (${resposta.status})`);
        }

        const dados = await resposta.json();

        const pesoPendencia = (pendencia) => {
          if (pendencia === "Finalizacao") return 0;
          if (pendencia === "Devolucao") return 1;
          return 2;
        };

        const tratada = (Array.isArray(dados) ? dados : []).map((item) => ({
          ...item,
          ajusteManual: item.ajusteManual || "",
        }));

        const ordenada = [...tratada].sort(
          (a, b) => pesoPendencia(a.pendencia) - pesoPendencia(b.pendencia)
        );

        this.baseOriginal = ordenada;
        this.base = [...ordenada];
      } catch (error) {
        console.error(error);
        Swal.fire("Erro", "Nao foi possivel carregar as rotas.", "error");
      }
    },

    filtrar() {
      Swal.fire({
        title: "Selecionar base",
        input: "select",
        inputPlaceholder: "Selecione a base",
        inputOptions: {
          TODAS: "Todas as bases",
          "Sao Paulo": "R2PP PARI",
          "R2PP PAVUNA": "R2PP PAVUNA",
          "Unidade Osasco": "Unidade Osasco",
        },
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        confirmButtonText: "Confirmar",
      }).then((result) => {
        if (!result.isConfirmed) return;

        const valor = result.value;

        if (valor === "TODAS") {
          this.base = [...this.baseOriginal];
          return;
        }

        this.base = this.baseOriginal.filter((item) =>
          String(item.filial || "").includes(valor)
        );
      });
    },

    limparFiltro() {
      this.base = [...this.baseOriginal];
    },

    async printTabela() {
      const element = document.getElementById("tabela-pendentes");
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = "base.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    },
  },
  mounted() {
    this.chamaApi();
  },
}).mount("#app");
