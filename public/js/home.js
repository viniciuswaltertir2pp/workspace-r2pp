// Dados do Sistema com URLs de redirecionamento
// Ex.: externa -> "https://..."
// Ex.: página interna (arquivo) -> "../html/outra-pagina.html"
// Ex.: seção desta tela -> "#transportadoras"
const DATA = {
    transportadoras: [
        { id: 1, name: 'Evolutivo de Rotas - Last Mile', icon: 'truck', desc: 'Monitoramento de rotas Last Mile', url: '/last-mile' },
        { id: 2, name: 'Evolutivo de Rotas - Milk Run', icon: 'truck', desc: 'Monitoramento de rotas Milk Run', url: '/milk' },
        { id: 3, name: 'Monitor de Sellers', icon: 'map-pin', desc: 'Monitoramento de Sellers', url: '/monitor-sellers' },
        { id: 4, name: 'Monitoramento de Cargas', icon: 'package', desc: 'Monitoramento de cargas', url: '/monitoramento-cargas' },
        { id: 5, name: 'Monitoramento de Performance', icon: 'chart-line', desc: 'Monitor SLA', url: '/sla-final' },
    ]//,
    // food: {
    //     '99': [
    //         { id: 101, name: '99Food Restaurantes', icon: 'utensils', desc: 'Gestão de pedidos 99', url: 'https://food.99app.com/' },
    //         { id: 102, name: '99 Entregas', icon: 'bike', desc: 'Painel de frotas locais', url: 'https://99app.com/entregas/' },
    //     ],
    //     'Keeta': [
    //         { id: 201, name: 'KeeTa Global', icon: 'utensils', desc: 'Plataforma de expansão', url: 'https://www.keeta.global/' },
    //         { id: 202, name: 'KeeTa Partner', icon: 'clock', desc: 'Portal do parceiro comercial', url: 'https://partner.keeta.global/' },
    //     ]
    // }
};

// Função para trocar de página
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);
}

// Função para redirecionar
function navigateTo(url) {
    if (!url) return;

    // Navegação para uma seção da própria página
    if (url.startsWith('#')) {
        const pageId = url.slice(1);
        if (document.getElementById(pageId)) {
            showPage(pageId);
            return;
        }
    }

    // URL externa: abre em nova aba
    if (/^https?:\/\//i.test(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    // Página interna do sistema: abre na mesma aba
    window.location.href = url;
}

// Função para criar o HTML do card com evento de clique para a URL
function createCard(item) {
    return `
                <div onclick="navigateTo('${item.url}')" class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group">
                    <div class="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <i data-lucide="${item.icon}" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 mb-2">${item.name}</h3>
                    <p class="text-gray-500 text-sm mb-4">${item.desc}</p>
                    <div class="flex items-center text-blue-600 font-medium text-sm">
                        Aceder sistema <i data-lucide="external-link" class="w-4 h-4 ml-1"></i>
                    </div>
                </div>
            `;
}

// Inicializar Transportadoras
const transContainer = document.getElementById('list-transportadoras');
transContainer.innerHTML = DATA.transportadoras.map(item => createCard(item)).join('');

// Abrir Detalhes de Food
function openFoodDetail(brand) {
    document.getElementById('food-title').innerText = `Serviços ${brand}`;
    const foodContainer = document.getElementById('list-food');
    foodContainer.innerHTML = DATA.food[brand].map(item => createCard(item)).join('');

    showPage('food-detail');
    lucide.createIcons(); // Recarrega os ícones nos novos elementos
}

// Inicializar Ícones Lucide
window.onload = () => {
    lucide.createIcons();
};
