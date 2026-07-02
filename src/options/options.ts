import { loadSettings, originPattern, saveSettings } from "../settings";
import { Profondeur, SearchProviderName, Settings } from "../types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const val = (id: string) => ($(id) as HTMLInputElement).value;

let current: Settings | null = null;

function setStatus(text: string, kind: "info" | "error") {
  const s = $("opt-status");
  s.hidden = false;
  s.className = `status status--${kind}`;
  s.textContent = text;
}

/** Affiche uniquement le champ de clé du fournisseur sélectionné. */
function syncProviderFields() {
  const provider = ($("searchProvider") as HTMLSelectElement).value;
  document.querySelectorAll<HTMLElement>("[data-provider]").forEach((el) => {
    el.style.display = el.dataset.provider === provider ? "" : "none";
  });
}

async function init() {
  const s = await loadSettings();
  current = s;
  ($("baseUrl") as HTMLInputElement).value = s.baseUrl;
  ($("apiKey") as HTMLInputElement).value = s.apiKey;
  ($("model") as HTMLInputElement).value = s.model;
  ($("searchProvider") as HTMLSelectElement).value = s.searchProvider;
  ($("tavilyApiKey") as HTMLInputElement).value = s.tavilyApiKey;
  ($("exaApiKey") as HTMLInputElement).value = s.exaApiKey;
  ($("jaccard") as HTMLInputElement).value = String(s.jaccardThreshold);
  ($("maxClaims") as HTMLInputElement).value = String(s.maxClaims);
  ($("language") as HTMLInputElement).value = s.language;
  ($("depth") as HTMLSelectElement).value = s.depth;
  syncProviderFields();
}

async function requestOrigin(url: string, label: string): Promise<boolean> {
  const pattern = originPattern(url);
  if (!pattern) { setStatus(`URL ${label} invalide.`, "error"); return false; }
  try {
    const granted = await browser.permissions.request({ origins: [pattern] });
    if (!granted) { setStatus(`Permission refusée pour ${label}.`, "error"); return false; }
  } catch { /* certains contextes n'exigent pas de permission explicite */ }
  return true;
}

async function save() {
  const searchProvider = ($("searchProvider") as HTMLSelectElement).value as SearchProviderName;
  const settings: Settings = {
    baseUrl: val("baseUrl").trim(),
    apiKey: val("apiKey").trim(),
    model: val("model").trim(),
    searchProvider,
    tavilyApiKey: val("tavilyApiKey").trim(),
    exaApiKey: val("exaApiKey").trim(),
    jaccardThreshold: Math.min(0.9, Math.max(0.1, parseFloat(val("jaccard")) || 0.5)),
    maxClaims: Math.min(5, Math.max(1, parseInt(val("maxClaims"), 10) || 3)),
    language: val("language").trim() || "français",
    depth: ($("depth") as HTMLSelectElement).value as Profondeur,
    transcriptLangs: current?.transcriptLangs ?? ["fr", "en"],
  };

  if (!settings.baseUrl || !settings.apiKey) {
    setStatus("URL de l'API et clé LLM sont requises.", "error");
    return;
  }
  if (!(await requestOrigin(settings.baseUrl, "l'API LLM"))) return;

  // Demande la permission d'hôte pour le moteur de recherche sélectionné, s'il a une clé.
  const searchKey = searchProvider === "exa" ? settings.exaApiKey : settings.tavilyApiKey;
  if (searchKey) {
    const searchUrl = searchProvider === "exa" ? "https://api.exa.ai" : "https://api.tavily.com";
    if (!(await requestOrigin(searchUrl, `la recherche ${searchProvider === "exa" ? "Exa" : "Tavily"}`))) return;
  }

  await saveSettings(settings);
  setStatus("Réglages enregistrés.", "info");
}

$("searchProvider").addEventListener("change", syncProviderFields);
$("save").addEventListener("click", () => void save());
void init();
