// Consulta em tempo real à Overpass API (OpenStreetMap).
import { CONFIG } from "./config.js";

const CONTACT_KEYS = "^(phone|mobile|contact:phone|contact:mobile|contact:whatsapp|whatsapp|contact:instagram|instagram)$";
const NO_SITE = '[!"website"][!"contact:website"][!"url"][!"contact:url"][!"website:menu"]';

const SOURCES = [
  '["shop"]["shop"!~"^(vacant|no|disused)$"]',
  '["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|biergarten|food_court|nightclub|dentist|clinic|doctors|veterinary|pharmacy|driving_school|language_school|music_school|dancing_school|kindergarten|childcare|prep_school|car_wash|car_rental|bicycle_rental|boat_rental|animal_boarding|spa|dojo|training|tutoring)$"]',
  '["craft"]',
  '["office"~"^(estate_agent|accountant|lawyer|insurance|architect|tax_advisor|notary|travel_agent|consulting|it|advertising_agency|employment_agency|coworking|financial|surveyor|engineer|graphic_design|photographer|moving_company|translator|event_management)$"]',
  '["tourism"~"^(hotel|guest_house|hostel|apartment|motel|chalet|camp_site|caravan_site|wine_cellar)$"]',
  '["leisure"~"^(fitness_centre|sports_centre|dance|escape_game|horse_riding|trampoline_park|bowling_alley|spa|sauna)$"]',
  '["healthcare"~"^(physiotherapist|psychotherapist|optometrist|podiatrist|alternative|audiologist|speech_therapist|occupational_therapist|dentist|clinic|doctor|nutrition_counselling|counselling|rehabilitation)$"]',
];

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/**
 * Monta a consulta Overpass QL.
 * @param {object} o
 * @param {object} o.district   distrito (data.js)
 * @param {string} [o.concelho] nome do concelho
 * @param {boolean} o.onlyNoSite
 * @param {boolean} o.excludeChains
 * @param {number} o.limit
 * @param {boolean} [o.useBbox] usa a caixa do distrito em vez da área oficial
 */
export function buildQuery({ district, concelho, onlyNoSite = true, excludeChains = true, limit = 2500, useBbox = false }) {
  const filters = `["name"]${onlyNoSite ? NO_SITE : ""}${excludeChains ? '[!"brand"][!"brand:wikidata"]' : ""}[~"${CONTACT_KEYS}"~"."]`;
  let head;
  let scope;
  if (useBbox) {
    const [s, w, n, e] = district.bbox;
    head = "";
    scope = `(${s},${w},${n},${e})`;
  } else if (concelho) {
    head =
      `area["ISO3166-2"="${district.iso}"]->.d;\n` +
      `rel(area.d)["boundary"="administrative"]["admin_level"="7"]["name"="${esc(concelho)}"];\n` +
      `map_to_area->.a;\n.a out ids;\n`;
    scope = "(area.a)";
  } else {
    head = `area["ISO3166-2"="${district.iso}"]->.a;\n.a out ids;\n`;
    scope = "(area.a)";
  }
  const body = SOURCES.map((src) => `  nwr${src}${filters}${scope};`).join("\n");
  return `[out:json][timeout:120];\n${head}(\n${body}\n);\nout center qt ${Math.max(50, Math.min(10000, limit | 0))};`;
}

let endpointIndex = 0;
export function currentEndpoint() {
  return CONFIG.overpassEndpoints[endpointIndex % CONFIG.overpassEndpoints.length];
}

/**
 * Executa a consulta, tentando os vários servidores Overpass em caso de erro ou fila cheia.
 * @returns {Promise<{elements: any[], areaFound: boolean, endpoint: string, remark?: string}>}
 */
export async function runQuery(query, { signal, onStatus } = {}) {
  const endpoints = CONFIG.overpassEndpoints;
  let lastErr;
  for (let attempt = 0; attempt < endpoints.length; attempt++) {
    const url = endpoints[(endpointIndex + attempt) % endpoints.length];
    const host = new URL(url).host;
    onStatus?.(`A consultar ${host}…`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), 135000);
    const relay = () => ctrl.abort(signal.reason);
    signal?.addEventListener("abort", relay, { once: true });
    try {
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        signal: ctrl.signal,
      });
      if (res.status === 429 || res.status === 504 || res.status === 502 || res.status === 503) {
        throw new Error(`${host} está ocupado (${res.status})`);
      }
      if (!res.ok) throw new Error(`${host} respondeu ${res.status}`);
      const json = await res.json();
      if (json.remark && /runtime error|out of memory/i.test(json.remark) && !(json.elements || []).some((e) => e.type !== "area")) {
        throw new Error(`${host}: ${json.remark.slice(0, 140)}`);
      }
      endpointIndex = (endpointIndex + attempt) % endpoints.length;
      const elements = json.elements || [];
      return {
        elements: elements.filter((e) => e.type !== "area"),
        areaFound: elements.some((e) => e.type === "area"),
        endpoint: host,
        remark: json.remark,
        osmBase: json.osm3s?.timestamp_osm_base,
      };
    } catch (err) {
      if (signal?.aborted) throw signal.reason || err;
      lastErr = err;
      onStatus?.(`${host} indisponível, a tentar outro servidor…`);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", relay);
    }
  }
  throw new Error(`Nenhum servidor OpenStreetMap respondeu. ${lastErr ? lastErr.message : ""}`.trim());
}

/** Procura negócios num distrito/concelho, com alternativa por caixa geográfica. */
export async function fetchLeads(opts, { signal, onStatus } = {}) {
  const q = buildQuery(opts);
  const r = await runQuery(q, { signal, onStatus });
  if (!r.areaFound && r.elements.length === 0) {
    onStatus?.("Área oficial não encontrada, a usar limites aproximados…");
    const r2 = await runQuery(buildQuery({ ...opts, useBbox: true }), { signal, onStatus });
    return { ...r2, approximate: true };
  }
  return r;
}
