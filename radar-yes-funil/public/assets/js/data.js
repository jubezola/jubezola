// Distritos e regiões autónomas de Portugal.
// iso: código ISO 3166-2 usado para encontrar a área no OpenStreetMap.
// grid: posição no mapa de azulejos [coluna, linha, largura].
// bbox: [sul, oeste, norte, este] — usado só como alternativa se a área não for encontrada.

export const DISTRICTS = [
  { id: "viana", name: "Viana do Castelo", iso: "PT-16", grid: [1, 1, 1], center: [41.78, -8.55], bbox: [41.65, -8.9, 42.16, -8.05],
    concelhos: ["Arcos de Valdevez", "Caminha", "Melgaço", "Monção", "Paredes de Coura", "Ponte da Barca", "Ponte de Lima", "Valença", "Viana do Castelo", "Vila Nova de Cerveira"] },
  { id: "braga", name: "Braga", iso: "PT-03", grid: [2, 1, 1], center: [41.55, -8.42], bbox: [41.3, -8.8, 41.85, -7.85],
    concelhos: ["Amares", "Barcelos", "Braga", "Cabeceiras de Basto", "Celorico de Basto", "Esposende", "Fafe", "Guimarães", "Póvoa de Lanhoso", "Terras de Bouro", "Vieira do Minho", "Vila Nova de Famalicão", "Vila Verde", "Vizela"] },
  { id: "vilareal", name: "Vila Real", iso: "PT-17", grid: [3, 1, 1], center: [41.3, -7.74], bbox: [41.1, -8.1, 41.95, -7.15],
    concelhos: ["Alijó", "Boticas", "Chaves", "Mesão Frio", "Mondim de Basto", "Montalegre", "Murça", "Peso da Régua", "Ribeira de Pena", "Sabrosa", "Santa Marta de Penaguião", "Valpaços", "Vila Pouca de Aguiar", "Vila Real"] },
  { id: "braganca", name: "Bragança", iso: "PT-04", grid: [4, 1, 1], center: [41.6, -6.85], bbox: [41.05, -7.45, 42.0, -6.18],
    concelhos: ["Alfândega da Fé", "Bragança", "Carrazeda de Ansiães", "Freixo de Espada à Cinta", "Macedo de Cavaleiros", "Miranda do Douro", "Mirandela", "Mogadouro", "Torre de Moncorvo", "Vila Flor", "Vimioso", "Vinhais"] },
  { id: "porto", name: "Porto", iso: "PT-13", grid: [2, 2, 1], center: [41.15, -8.61], bbox: [41.0, -8.8, 41.45, -7.85],
    concelhos: ["Amarante", "Baião", "Felgueiras", "Gondomar", "Lousada", "Maia", "Marco de Canaveses", "Matosinhos", "Paços de Ferreira", "Paredes", "Penafiel", "Porto", "Póvoa de Varzim", "Santo Tirso", "Trofa", "Valongo", "Vila do Conde", "Vila Nova de Gaia"] },
  { id: "viseu", name: "Viseu", iso: "PT-18", grid: [3, 2, 1], center: [40.66, -7.91], bbox: [40.35, -8.45, 41.2, -7.3],
    concelhos: ["Armamar", "Carregal do Sal", "Castro Daire", "Cinfães", "Lamego", "Mangualde", "Moimenta da Beira", "Mortágua", "Nelas", "Oliveira de Frades", "Penalva do Castelo", "Penedono", "Resende", "Santa Comba Dão", "São João da Pesqueira", "São Pedro do Sul", "Sátão", "Sernancelhe", "Tabuaço", "Tarouca", "Tondela", "Vila Nova de Paiva", "Viseu", "Vouzela"] },
  { id: "guarda", name: "Guarda", iso: "PT-09", grid: [4, 2, 1], center: [40.54, -7.27], bbox: [40.25, -7.9, 41.2, -6.75],
    concelhos: ["Aguiar da Beira", "Almeida", "Celorico da Beira", "Figueira de Castelo Rodrigo", "Fornos de Algodres", "Gouveia", "Guarda", "Manteigas", "Mêda", "Pinhel", "Sabugal", "Seia", "Trancoso", "Vila Nova de Foz Côa"] },
  { id: "aveiro", name: "Aveiro", iso: "PT-01", grid: [2, 3, 1], center: [40.64, -8.65], bbox: [40.35, -8.85, 41.1, -8.1],
    concelhos: ["Águeda", "Albergaria-a-Velha", "Anadia", "Arouca", "Aveiro", "Castelo de Paiva", "Espinho", "Estarreja", "Ílhavo", "Mealhada", "Murtosa", "Oliveira de Azeméis", "Oliveira do Bairro", "Ovar", "Santa Maria da Feira", "São João da Madeira", "Sever do Vouga", "Vagos", "Vale de Cambra"] },
  { id: "coimbra", name: "Coimbra", iso: "PT-06", grid: [3, 3, 1], center: [40.2, -8.42], bbox: [39.95, -8.95, 40.45, -7.7],
    concelhos: ["Arganil", "Cantanhede", "Coimbra", "Condeixa-a-Nova", "Figueira da Foz", "Góis", "Lousã", "Mira", "Miranda do Corvo", "Montemor-o-Velho", "Oliveira do Hospital", "Pampilhosa da Serra", "Penacova", "Penela", "Soure", "Tábua", "Vila Nova de Poiares"] },
  { id: "castelobranco", name: "Castelo Branco", iso: "PT-05", grid: [4, 3, 1], center: [39.82, -7.49], bbox: [39.55, -8.2, 40.35, -6.85],
    concelhos: ["Belmonte", "Castelo Branco", "Covilhã", "Fundão", "Idanha-a-Nova", "Oleiros", "Penamacor", "Proença-a-Nova", "Sertã", "Vila de Rei", "Vila Velha de Ródão"] },
  { id: "leiria", name: "Leiria", iso: "PT-10", grid: [2, 4, 1], center: [39.74, -8.81], bbox: [39.2, -9.55, 40.1, -8.1],
    concelhos: ["Alcobaça", "Alvaiázere", "Ansião", "Batalha", "Bombarral", "Caldas da Rainha", "Castanheira de Pera", "Figueiró dos Vinhos", "Leiria", "Marinha Grande", "Nazaré", "Óbidos", "Pedrógão Grande", "Peniche", "Pombal", "Porto de Mós"] },
  { id: "santarem", name: "Santarém", iso: "PT-14", grid: [3, 4, 1], center: [39.24, -8.69], bbox: [38.75, -9.0, 39.85, -7.8],
    concelhos: ["Abrantes", "Alcanena", "Almeirim", "Alpiarça", "Benavente", "Cartaxo", "Chamusca", "Constância", "Coruche", "Entroncamento", "Ferreira do Zêzere", "Golegã", "Mação", "Ourém", "Rio Maior", "Salvaterra de Magos", "Santarém", "Sardoal", "Tomar", "Torres Novas", "Vila Nova da Barquinha"] },
  { id: "portalegre", name: "Portalegre", iso: "PT-12", grid: [4, 4, 1], center: [39.29, -7.43], bbox: [38.8, -8.3, 39.65, -6.95],
    concelhos: ["Alter do Chão", "Arronches", "Avis", "Campo Maior", "Castelo de Vide", "Crato", "Elvas", "Fronteira", "Gavião", "Marvão", "Monforte", "Nisa", "Ponte de Sor", "Portalegre", "Sousel"] },
  { id: "lisboa", name: "Lisboa", iso: "PT-11", grid: [2, 5, 1], center: [38.72, -9.14], bbox: [38.65, -9.5, 39.35, -8.85],
    concelhos: ["Alenquer", "Amadora", "Arruda dos Vinhos", "Azambuja", "Cadaval", "Cascais", "Lisboa", "Loures", "Lourinhã", "Mafra", "Odivelas", "Oeiras", "Sintra", "Sobral de Monte Agraço", "Torres Vedras", "Vila Franca de Xira"] },
  { id: "evora", name: "Évora", iso: "PT-07", grid: [3, 5, 1], center: [38.57, -7.91], bbox: [38.15, -8.65, 39.0, -7.1],
    concelhos: ["Alandroal", "Arraiolos", "Borba", "Estremoz", "Évora", "Montemor-o-Novo", "Mora", "Mourão", "Portel", "Redondo", "Reguengos de Monsaraz", "Vendas Novas", "Viana do Alentejo", "Vila Viçosa"] },
  { id: "setubal", name: "Setúbal", iso: "PT-15", grid: [2, 6, 1], center: [38.52, -8.89], bbox: [37.75, -9.25, 38.75, -8.15],
    concelhos: ["Alcácer do Sal", "Alcochete", "Almada", "Barreiro", "Grândola", "Moita", "Montijo", "Palmela", "Santiago do Cacém", "Seixal", "Sesimbra", "Setúbal", "Sines"] },
  { id: "beja", name: "Beja", iso: "PT-02", grid: [3, 6, 1], center: [37.95, -7.86], bbox: [37.3, -8.85, 38.35, -6.95],
    concelhos: ["Aljustrel", "Almodôvar", "Alvito", "Barrancos", "Beja", "Castro Verde", "Cuba", "Ferreira do Alentejo", "Mértola", "Moura", "Odemira", "Ourique", "Serpa", "Vidigueira"] },
  { id: "faro", name: "Faro", iso: "PT-08", grid: [2, 7, 2], center: [37.02, -7.93], bbox: [36.95, -9.0, 37.55, -7.4],
    concelhos: ["Albufeira", "Alcoutim", "Aljezur", "Castro Marim", "Faro", "Lagoa", "Lagos", "Loulé", "Monchique", "Olhão", "Portimão", "São Brás de Alportel", "Silves", "Tavira", "Vila do Bispo", "Vila Real de Santo António"] },
  { id: "acores", name: "Açores", iso: "PT-20", grid: [1, 5, 1], island: true, center: [37.74, -25.67], bbox: [36.9, -31.3, 39.75, -24.75],
    concelhos: ["Angra do Heroísmo", "Calheta", "Corvo", "Horta", "Lagoa", "Lajes das Flores", "Lajes do Pico", "Madalena", "Nordeste", "Ponta Delgada", "Povoação", "Praia da Vitória", "Ribeira Grande", "Santa Cruz da Graciosa", "Santa Cruz das Flores", "São Roque do Pico", "Velas", "Vila do Porto", "Vila Franca do Campo"] },
  { id: "madeira", name: "Madeira", iso: "PT-30", grid: [1, 6, 1], island: true, center: [32.7, -16.95], bbox: [32.38, -17.3, 33.15, -16.25],
    concelhos: ["Calheta", "Câmara de Lobos", "Funchal", "Machico", "Ponta do Sol", "Porto Moniz", "Porto Santo", "Ribeira Brava", "Santa Cruz", "Santana", "São Vicente"] },
];

export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));

// Categorias de negócio. `match` recebe as tags OSM e devolve true se o negócio pertence à categoria.
// `weight` reflete o quanto um negócio deste tipo costuma beneficiar (e pagar) por um website.
const any = (tags, key, list) => tags[key] !== undefined && (list === "*" || list.includes(tags[key]));

export const CATEGORIES = [
  { id: "restauracao", label: "Restauração e cafés", short: "Restauração", noun: "restaurantes e cafés", weight: 11,
    match: (t) => any(t, "amenity", ["restaurant", "cafe", "bar", "pub", "fast_food", "ice_cream", "biergarten", "food_court", "nightclub"]) || any(t, "shop", ["bakery", "pastry", "confectionery"]) },
  { id: "beleza", label: "Beleza e estética", short: "Beleza", noun: "salões de beleza e estética", weight: 13,
    match: (t) => any(t, "shop", ["hairdresser", "beauty", "cosmetics", "massage", "tattoo", "perfumery", "hairdresser_supply", "nails"]) || any(t, "leisure", ["spa", "sauna"]) || any(t, "amenity", ["spa"]) },
  { id: "saude", label: "Saúde e clínicas", short: "Saúde", noun: "clínicas e consultórios", weight: 14,
    match: (t) => any(t, "amenity", ["dentist", "clinic", "doctors", "pharmacy"]) || t.healthcare !== undefined || any(t, "shop", ["optician", "hearing_aids", "medical_supply", "herbalist", "nutrition_supplements"]) },
  { id: "fitness", label: "Desporto e fitness", short: "Fitness", noun: "ginásios e estúdios", weight: 12,
    match: (t) => any(t, "leisure", ["fitness_centre", "sports_centre", "dance", "escape_game", "horse_riding", "trampoline_park", "bowling_alley"]) || any(t, "amenity", ["dancing_school", "dojo"]) || any(t, "shop", ["sports", "outdoor", "bicycle", "scuba_diving", "surf"]) },
  { id: "animais", label: "Animais", short: "Animais", noun: "clínicas veterinárias e lojas de animais", weight: 11,
    match: (t) => any(t, "amenity", ["veterinary", "animal_boarding", "animal_shelter"]) || any(t, "shop", ["pet", "pet_grooming"]) },
  { id: "alojamento", label: "Alojamento e turismo", short: "Alojamento", noun: "alojamentos e turismo", weight: 15,
    match: (t) => t.tourism !== undefined || any(t, "shop", ["travel_agency"]) || any(t, "office", ["travel_agent"]) || any(t, "amenity", ["boat_rental", "bicycle_rental", "car_rental"]) },
  { id: "casa", label: "Casa, obras e reparações", short: "Casa e obras", noun: "profissionais de obras e reparações", weight: 12,
    match: (t) => any(t, "craft", ["carpenter", "electrician", "plumber", "painter", "tiler", "roofer", "glaziery", "hvac", "locksmith", "builder", "stonemason", "metal_construction", "window_construction", "upholsterer", "floorer", "insulation", "gardener", "cleaning", "joiner", "plasterer", "scaffolder", "blacksmith"]) || any(t, "shop", ["furniture", "hardware", "doityourself", "interior_decoration", "kitchen", "bathroom_furnishing", "flooring", "paint", "lighting", "garden_centre", "houseware", "curtain", "bed", "carpet", "tiles", "trade", "energy", "appliance"]) },
  { id: "auto", label: "Automóvel", short: "Automóvel", noun: "oficinas e stands", weight: 11,
    match: (t) => any(t, "shop", ["car", "car_repair", "car_parts", "tyres", "motorcycle", "motorcycle_repair"]) || any(t, "amenity", ["car_wash", "driving_school"]) || any(t, "craft", ["car_repair"]) },
  { id: "moda", label: "Moda e acessórios", short: "Moda", noun: "lojas de moda", weight: 9,
    match: (t) => any(t, "shop", ["clothes", "shoes", "jewelry", "bag", "boutique", "fashion_accessories", "fabric", "tailor", "watches", "leather", "second_hand", "baby_goods", "wool", "sewing"]) },
  { id: "educacao", label: "Educação e formação", short: "Educação", noun: "escolas e centros de formação", weight: 12,
    match: (t) => any(t, "amenity", ["language_school", "music_school", "kindergarten", "childcare", "prep_school", "training", "tutoring"]) },
  { id: "servicos", label: "Serviços e escritórios", short: "Serviços", noun: "empresas de serviços", weight: 12,
    match: (t) => t.office !== undefined || t.craft !== undefined || any(t, "shop", ["laundry", "dry_cleaning", "copyshop", "funeral_directors", "photo", "printing", "mobile_phone", "computer", "electronics", "electrical", "repair", "insurance", "estate_agent", "money_lender", "storage_rental"]) },
  { id: "alimentar", label: "Mercearia e alimentar", short: "Alimentar", noun: "mercearias e lojas de alimentação", weight: 7,
    match: (t) => any(t, "shop", ["supermarket", "convenience", "butcher", "greengrocer", "deli", "wine", "alcohol", "seafood", "cheese", "farm", "beverages", "coffee", "tea", "chocolate", "frozen_food", "health_food", "pasta", "spices", "dairy", "general"]) },
  { id: "lojas", label: "Outras lojas", short: "Lojas", noun: "lojas locais", weight: 8,
    match: (t) => t.shop !== undefined || t.amenity !== undefined || t.leisure !== undefined },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export function categorize(tags) {
  for (const c of CATEGORIES) if (c.match(tags)) return c;
  return CATEGORY_BY_ID.lojas;
}

// Nomes de tipos OSM em português, para mostrar no lead.
export const TYPE_LABELS = {
  restaurant: "Restaurante", cafe: "Café", bar: "Bar", pub: "Pub", fast_food: "Comida rápida", ice_cream: "Gelataria", nightclub: "Discoteca",
  bakery: "Padaria", pastry: "Pastelaria", confectionery: "Confeitaria", hairdresser: "Cabeleireiro", beauty: "Estética", cosmetics: "Cosmética",
  massage: "Massagens", tattoo: "Tatuagens", perfumery: "Perfumaria", nails: "Unhas", spa: "Spa", sauna: "Sauna", dentist: "Dentista", clinic: "Clínica", doctors: "Consultório",
  pharmacy: "Farmácia", physiotherapist: "Fisioterapia", psychotherapist: "Psicologia", optometrist: "Optometria", podiatrist: "Podologia", alternative: "Terapias",
  optician: "Óptica", hearing_aids: "Aparelhos auditivos", fitness_centre: "Ginásio", sports_centre: "Centro desportivo", dance: "Dança", escape_game: "Escape room",
  dancing_school: "Escola de dança", veterinary: "Veterinário", pet: "Loja de animais", pet_grooming: "Banhos e tosquias", hotel: "Hotel", guest_house: "Alojamento local",
  hostel: "Hostel", apartment: "Apartamentos", motel: "Motel", camp_site: "Parque de campismo", chalet: "Chalé", travel_agency: "Agência de viagens", travel_agent: "Agência de viagens",
  carpenter: "Carpintaria", electrician: "Eletricista", plumber: "Canalizador", painter: "Pintor", tiler: "Ladrilhador", roofer: "Telhados", locksmith: "Serralharia",
  builder: "Construção", stonemason: "Cantaria", metal_construction: "Serralharia", window_construction: "Caixilharia", upholsterer: "Estofador", gardener: "Jardinagem",
  furniture: "Mobiliário", hardware: "Ferragens", doityourself: "Bricolage", interior_decoration: "Decoração", kitchen: "Cozinhas", flooring: "Pavimentos", paint: "Tintas",
  lighting: "Iluminação", garden_centre: "Centro de jardinagem", car: "Stand automóvel", car_repair: "Oficina", car_parts: "Peças auto", tyres: "Pneus", motorcycle: "Motos",
  car_wash: "Lavagem auto", driving_school: "Escola de condução", clothes: "Roupa", shoes: "Sapataria", jewelry: "Joalharia", bag: "Malas", boutique: "Boutique",
  fabric: "Tecidos", tailor: "Alfaiate", watches: "Relojoaria", second_hand: "Segunda mão", language_school: "Escola de línguas", music_school: "Escola de música",
  kindergarten: "Jardim de infância", childcare: "Creche", prep_school: "Centro de explicações", accountant: "Contabilidade", lawyer: "Advogado", insurance: "Seguros",
  estate_agent: "Imobiliária", architect: "Arquitetura", tax_advisor: "Consultoria fiscal", notary: "Notário", consulting: "Consultoria", it: "Informática",
  laundry: "Lavandaria", dry_cleaning: "Limpeza a seco", copyshop: "Reprografia", funeral_directors: "Agência funerária", photo: "Fotografia", photographer: "Fotógrafo",
  printing: "Gráfica", mobile_phone: "Telemóveis", computer: "Informática", electronics: "Eletrónica", supermarket: "Supermercado", convenience: "Mercearia",
  butcher: "Talho", greengrocer: "Frutaria", deli: "Charcutaria", wine: "Garrafeira", alcohol: "Bebidas", seafood: "Peixaria", cheese: "Queijaria", farm: "Produtos da quinta",
  coffee: "Café em grão", chocolate: "Chocolataria", health_food: "Produtos naturais", florist: "Florista", gift: "Prendas", books: "Livraria", toys: "Brinquedos",
  stationery: "Papelaria", sports: "Desporto", bicycle: "Bicicletas", newsagent: "Quiosque", tobacco: "Tabacaria", variety_store: "Bazar", kiosk: "Quiosque",
  shoemaker: "Sapateiro", hvac: "Climatização", glaziery: "Vidraria", cleaning: "Limpezas", boat_rental: "Aluguer de barcos", car_rental: "Rent-a-car", bicycle_rental: "Aluguer de bicicletas",
};

// Nomes que indicam entidades públicas — não são clientes para um website pago.
export const PUBLIC_NAME_RE = /^(USF|UCSP|UCC|ACES|Centro de Sa[uú]de|Junta de Freguesia|C[aâ]mara Municipal|Escola (B[aá]sica|Secund[aá]ria)|Agrupamento de Escolas|Hospital( de| do| da)? |Posto (de Turismo|dos CTT)|CTT|GNR|PSP|Bombeiros|Santa Casa da Miseric[oó]rdia|Paróquia|Igreja)/i;
