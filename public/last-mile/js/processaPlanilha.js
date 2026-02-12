const { createApp } = Vue;

createApp({
  data() {
    return {
      todasRotas: [],
      filtroRegiao: "",
      carregando: false,
    };
  },

  computed: {
    rotasFiltradas() {
      if (!this.filtroRegiao) return this.todasRotas;

      const filtro = this.filtroRegiao.toLowerCase();
      return this.todasRotas.filter((rota) => {
        if (!rota.filial) return false;
        return rota.filial.toLowerCase().includes(filtro);
      });
    },
  },

  methods: {
    async buscarRotas() {
      try {
        this.carregando = true;

        const resposta = await fetch("/api/last-mile/buscar-base", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!resposta.ok) {
          throw new Error("Falha ao consultar API");
        }

        this.todasRotas = await resposta.json();
      } catch (erro) {
        console.error(erro);
        if (window.Swal) {
          Swal.fire("Erro", "Nao foi possivel carregar as rotas.", "error");
        }
      } finally {
        this.carregando = false;
      }
    },

    async printTabela() {
      const elemento = document.getElementById("tabela-rotas");
      if (!elemento) return;

      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = "tabela_rotas.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    },

    getPercRotaClass(rota) {
      if (rota.percRota == null) return "";

      let valor = rota.percRota;
      if (typeof valor === "string") {
        valor = valor.replace("%", "").trim().replace(",", ".");
      }

      valor = parseFloat(valor);
      if (Number.isNaN(valor)) return "";

      if (valor < 80) return "perc-rota-baixo";
      if (valor < 99.9) return "perc-rota-medio";
      return "perc-rota-alto";
    },

    getPercEntregaClass(rota) {
      if (rota.percEntrega == null) return "";

      let valor = rota.percEntrega;
      if (typeof valor === "string") {
        valor = valor.replace("%", "").trim().replace(",", ".");
      }

      valor = parseFloat(valor);
      if (Number.isNaN(valor)) return "";

      if (valor < 70) return "perc-rota-baixo";
      if (valor <= 98) return "perc-rota-medio";
      return "perc-rota-alto";
    },
  },

  mounted() {
    this.buscarRotas();
  },
}).mount("#app");