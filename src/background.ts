import { groundClaim } from "./grounding";
import { analyser } from "./llm";
import { loadSettings } from "./settings";
import {
  AffirmationCle, AnalyzeRequest, AnalyzeResponse, ExtractResult,
  GroundRequest, GroundResponse, Mode,
} from "./types";

browser.action.onClicked.addListener(() => {
  void browser.sidebarAction.open();
});

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function extractFromPage(mode: Mode): Promise<ExtractResult> {
  const tabId = await activeTabId();
  if (tabId === undefined) return { ok: false, error: "Aucun onglet actif." };
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch {
    return {
      ok: false,
      error: "Accès à la page refusé. Ouvre le panneau via l'icône de la barre d'outils sur la page à analyser.",
    };
  }
  return (await browser.tabs.sendMessage(tabId, { type: "CRIBLE_EXTRACT", mode })) as ExtractResult;
}

async function handleAnalyze(mode: Mode): Promise<AnalyzeResponse> {
  const settings = await loadSettings();
  if (!settings.baseUrl || !settings.apiKey) {
    return { ok: false, error: "Configuration incomplète : renseigne l'URL de l'API et la clé dans les réglages." };
  }
  const extracted = await extractFromPage(mode);
  if (!extracted.ok || !extracted.text) {
    return { ok: false, error: extracted.error ?? "Extraction impossible." };
  }
  try {
    const meta = { title: extracted.title ?? "", url: extracted.url ?? "" };
    const analyse = await analyser(settings, meta, extracted.text);
    return { ok: true, analyse, meta: { ...meta, mode } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur d'analyse." };
  }
}

async function handleGround(claim: AffirmationCle): Promise<GroundResponse> {
  const settings = await loadSettings();
  const providerLabel = settings.searchProvider === "exa" ? "Exa" : "Tavily";
  const keyManquante = settings.searchProvider === "exa" ? !settings.exaApiKey : !settings.tavilyApiKey;
  if (keyManquante) {
    return { ok: false, error: `Ajoute ta clé de recherche (${providerLabel}) dans les réglages pour vérifier les sources.` };
  }
  if (!settings.baseUrl || !settings.apiKey) {
    return { ok: false, error: "Configuration LLM incomplète (URL de l'API et clé)." };
  }
  try {
    const result = await groundClaim(settings, claim);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur d'ancrage." };
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as AnalyzeRequest | GroundRequest;
  if (msg?.type === "ANALYZE") return handleAnalyze(msg.mode);
  if (msg?.type === "GROUND_CLAIM") return handleGround(msg.claim);
  return undefined;
});
