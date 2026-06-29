import { loadSettings, originPattern, saveSettings } from "../settings";
import { Profondeur, Settings } from "../types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const val = (id: string) => ($(id) as HTMLInputElement).value;

function setStatus(text: string, kind: "info" | "error") {
  const s = $("opt-status");
  s.hidden = false;
  s.className = `status status--${kind}`;
  s.textContent = text;
}

async function init() {
  const s = await loadSettings();
  ($("baseUrl") as HTMLInputElement).value = s.baseUrl;
  ($("apiKey") as HTMLInputElement).value = s.apiKey;
  ($("model") as HTMLInputElement).value = s.model;
  ($("tavilyApiKey") as HTMLInputElement).value = s.tavilyApiKey;
  ($("jaccard") as HTMLInputElement).value = String(s.jaccardThreshold);
  ($("maxClaims") as HTMLInputElement).value = String(s.maxClaims);
  ($("language") as HTMLInputElement).value = s.language;
  ($("depth") as HTMLSelectElement).value = s.depth;
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
  const settings: Settings = {
    baseUrl: val("baseUrl").trim(),
    apiKey: val("apiKey").trim(),
    model: val("model").trim(),
    tavilyApiKey: val("tavilyApiKey").trim(),
    jaccardThreshold: Math.min(0.9, Math.max(0.1, parseFloat(val("jaccard")) || 0.5)),
    maxClaims: Math.min(5, Math.max(1, parseInt(val("maxClaims"), 10) || 3)),
    language: val("language").trim() || "français",
    depth: ($("depth") as HTMLSelectElement).value as Profondeur,
  };

  if (!settings.baseUrl || !settings.apiKey) {
    setStatus("URL de l'API et clé LLM sont requises.", "error");
    return;
  }
  if (!(await requestOrigin(settings.baseUrl, "l'API LLM"))) return;

  if (settings.tavilyApiKey) {
    if (!(await requestOrigin("https://api.tavily.com", "la recherche Tavily"))) return;
  }

  await saveSettings(settings);
  setStatus("Réglages enregistrés.", "info");
}

$("save").addEventListener("click", () => void save());
void init();
