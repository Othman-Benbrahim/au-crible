import { groundClaim } from "./grounding";
import { analyser } from "./llm";
import { loadSettings } from "./settings";
import { buildVideoAnalysis } from "./transcript";
import { isYouTubeWatch, readTranscriptInPage } from "./youtube";
import {
  AffirmationCle, AnalyzeRequest, AnalyzeResponse, ExtractResult,
  GroundRequest, GroundResponse, Mode,
  VideoAnalyzeRequest, VideoAnalyzeResponse, YtSeekRequest,
} from "./types";

browser.action.onClicked.addListener(() => {
  void browser.sidebarAction.open();
});

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// Les types @types/firefox-webext-browser sont en retard : ils ignorent world:"MAIN"
// et les args, pourtant supportés par Firefox 128+. Wrapper typé, cast localisé.
async function execInMain<T>(
  tabId: number, func: (...a: never[]) => T, args: unknown[],
): Promise<T | undefined> {
  const exec = browser.scripting.executeScript as unknown as (
    d: { target: { tabId: number }; world: string; func: (...a: never[]) => T; args: unknown[] },
  ) => Promise<{ result?: T }[]>;
  const results = await exec({ target: { tabId }, world: "MAIN", func, args });
  return results?.[0]?.result;
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

async function handleVideoAnalyze(): Promise<VideoAnalyzeResponse> {
  const settings = await loadSettings();
  if (!settings.baseUrl || !settings.apiKey) {
    return { ok: false, error: "Configuration LLM incomplète (URL de l'API et clé) dans les réglages." };
  }
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: "Aucun onglet actif." };
  if (!tab.url || !isYouTubeWatch(tab.url)) {
    return { ok: false, error: "Ouvre une vidéo YouTube (page /watch), puis relance." };
  }

  let res: Awaited<ReturnType<typeof readTranscriptInPage>> | undefined;
  try {
    res = await execInMain(
      tab.id,
      readTranscriptInPage as unknown as (...a: never[]) => Promise<Awaited<ReturnType<typeof readTranscriptInPage>>>,
      [settings.transcriptLangs],
    );
  } catch {
    return { ok: false, error: "Accès au lecteur YouTube refusé. Ouvre le panneau via l'icône de la barre d'outils sur la page vidéo." };
  }
  if (!res?.ok || !res.segments) {
    return { ok: false, error: res?.error ?? "Transcription indisponible." };
  }

  try {
    const analysis = await buildVideoAnalysis(settings, res.videoId ?? "", res.titre ?? "", res.segments);
    return { ok: true, analysis };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur d'analyse vidéo." };
  }
}

async function handleSeek(seconds: number): Promise<void> {
  const tabId = await activeTabId();
  if (tabId === undefined) return;
  try {
    await execInMain(
      tabId,
      ((t: number) => {
        const v = document.querySelector("video");
        if (v) { v.currentTime = t; void v.play?.(); }
      }) as unknown as (...a: never[]) => void,
      [seconds],
    );
  } catch { /* onglet non éligible */ }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as AnalyzeRequest | GroundRequest | VideoAnalyzeRequest | YtSeekRequest;
  if (msg?.type === "ANALYZE") return handleAnalyze(msg.mode);
  if (msg?.type === "GROUND_CLAIM") return handleGround(msg.claim);
  if (msg?.type === "VIDEO_ANALYZE") return handleVideoAnalyze();
  if (msg?.type === "YT_SEEK") return handleSeek(msg.seconds);
  return undefined;
});
