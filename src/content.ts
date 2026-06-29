import { Readability } from "@mozilla/readability";
import { ExtractRequest, ExtractResult, Mode } from "./types";

// Évite d'enregistrer deux fois l'écouteur si le script est ré-injecté.
declare global {
  interface Window { __cribleInjected?: boolean }
}

function extract(mode: Mode): ExtractResult {
  try {
    if (mode === "selection") {
      const sel = window.getSelection()?.toString().trim() ?? "";
      if (!sel) return { ok: false, error: "Aucun texte sélectionné sur la page." };
      return { ok: true, title: document.title, url: location.href, text: sel };
    }
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    const text = (article?.textContent ?? "").trim();
    if (!text || text.length < 200) {
      return {
        ok: false,
        error: "Impossible d'extraire un article lisible ici. Sélectionne un passage, puis relance.",
      };
    }
    return {
      ok: true,
      title: article?.title || document.title,
      url: location.href,
      text,
    };
  } catch {
    return { ok: false, error: "Erreur pendant l'extraction du contenu de la page." };
  }
}

if (!window.__cribleInjected) {
  window.__cribleInjected = true;
  browser.runtime.onMessage.addListener((message: unknown) => {
    const msg = message as ExtractRequest;
    if (msg?.type === "CRIBLE_EXTRACT") {
      return Promise.resolve(extract(msg.mode));
    }
    return undefined;
  });
}
