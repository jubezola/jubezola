// ─────────────────────────────────────────────────────────────
//  Configuração da marca e do comportamento da ferramenta.
//  Edita este ficheiro antes de publicar/vender.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  brand: "LeadRadar",
  brandSuffix: "Portugal",
  supportEmail: "",            // aparece no rodapé, se preenchido

  // Valores por omissão das Definições (cada utilizador pode mudar no próprio browser).
  defaults: {
    sellerName: "",
    sellerPhone: "",           // o teu WhatsApp, para receber o resumo do relatório
    reportEmail: "",
    sitePrice: 450,            // preço médio de um website, em euros
    maxResults: 2500,          // máximo de negócios por pesquisa
    autoRefreshMin: 10,        // atualização automática em minutos (0 = desligado)
    excludeChains: true,       // excluir cadeias e franchisings (tag brand do OSM)
    onlyNoSite: true,          // mostrar só negócios sem website
    template: "primeiro",      // modelo de mensagem para WhatsApp
    templateIg: "instagram",   // modelo de mensagem para Instagram
  },

  // Servidores públicos da Overpass API (dados do OpenStreetMap, atualizados ao minuto).
  // A ferramenta tenta o seguinte se um estiver ocupado.
  overpassEndpoints: [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ],

  cacheMinutes: 30,            // resultados guardados no browser durante este tempo
  scanPauseMs: 1500,           // pausa entre distritos na varredura nacional

  // Endpoint opcional (Netlify Function) para enviar o relatório por email.
  emailEndpoint: "/api/send-report",
};

// Modelos de mensagem. Variáveis: {nome} {cidade} {categoria} {meu_nome} {preco}
export const TEMPLATES = {
  primeiro: {
    label: "Primeiro contacto",
    text: "Olá! Daqui fala {meu_nome}. Vi o vosso espaço, {nome}, em {cidade}, e reparei que ainda não têm website. Faço sites para {categoria}: rápidos, bem posicionados no Google e com botão direto para WhatsApp. Posso enviar-lhe um exemplo, sem compromisso?",
  },
  preco: {
    label: "Com preço",
    text: "Olá, bom dia! Daqui fala {meu_nome}. Crio websites para negócios de {cidade} e vi que {nome} ainda não tem site próprio no Google. Consigo pôr o vosso online numa semana, a partir de {preco}€, com domínio, alojamento e Google Maps incluídos. Quer ver uma proposta?",
  },
  instagram: {
    label: "Para quem já está no Instagram",
    text: "Olá! Vi o Instagram de {nome} e gostei muito do trabalho. Daqui fala {meu_nome}: já pensaram ter um website para transformar seguidores em marcações e clientes de {cidade}? Faço isso a partir de {preco}€. Posso enviar uma ideia de como ficaria?",
  },
  seguimento: {
    label: "Seguimento",
    text: "Olá, daqui fala {meu_nome} outra vez. Há uns dias falámos sobre um website para {nome}. Preparei um exemplo rápido para {categoria} em {cidade}. Posso enviar-lhe agora?",
  },
};

export const PIPELINE_STAGES = [
  { id: "guardado", label: "Guardado" },
  { id: "contactado", label: "Contactado" },
  { id: "interessado", label: "Interessado" },
  { id: "fechado", label: "Fechado" },
  { id: "perdido", label: "Perdido" },
];
