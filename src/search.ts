// Récupération via Tavily (clé de l'utilisateur, appelée depuis le background).
// Requêtes adversariales par gabarit (zéro appel LLM) : on va chercher la
// contradiction, pas seulement la confirmation.

import { AffirmationCle, Intent, SearchCandidate, Settings } from "./types";
import { registrableDomain } from "./independence";

interface TavilyResult { title?: string; url?: string; content?: string; score?: number; published_date?: string }
interface TavilyResponse { results?: TavilyResult[] }

export function buildQueries(claim: AffirmationCle): { intent: Intent; q: string }[] {
  const base = claim.normalisee.trim();
  return [
    { intent: "neutre", q: base },
    { intent: "refutation", q: `${base} (démenti OR erreur OR controverse OR rétractation OR critique)` },
    { intent: "primaire", q: `${base} (étude OR rapport OR données OR "source originale")` },
  ];
}

async function tavilySearch(settings: Settings, query: string): Promise<TavilyResult[]> {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: settings.tavilyApiKey,
      query,
      max_results: 4,
      search_depth: settings.depth === "approfondi" ? "advanced" : "basic",
      include_answer: false,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Tavily a renvoyé une erreur ${resp.status}. Vérifie ta clé de recherche.`);
  }
  const data = (await resp.json().catch(() => ({}))) as TavilyResponse;
  return data.results ?? [];
}

/** Lance les 3 requêtes, fusionne, tague par intention, dédoublonne les URL. */
export async function searchClaim(
  settings: Settings,
  claim: AffirmationCle,
): Promise<SearchCandidate[]> {
  const queries = buildQueries(claim);
  const byUrl = new Map<string, SearchCandidate>();

  for (const { intent, q } of queries) {
    let results: TavilyResult[] = [];
    try {
      results = await tavilySearch(settings, q);
    } catch (e) {
      if (intent === "neutre") throw e; // si même la requête neutre échoue, on remonte
      continue; // sinon on tolère l'échec d'une variante
    }
    for (const r of results) {
      if (!r.url) continue;
      const existing = byUrl.get(r.url);
      if (existing) {
        if (!existing.surfacePar.includes(intent)) existing.surfacePar.push(intent);
        continue;
      }
      let domaine = "";
      try { domaine = registrableDomain(new URL(r.url).hostname); } catch { domaine = r.url; }
      byUrl.set(r.url, {
        url: r.url,
        domaine,
        titre: r.title ?? "",
        extrait: r.content ?? "",
        date: r.published_date,
        surfacePar: [intent],
        score: r.score,
      });
    }
  }

  // Plafond : 8 candidats les mieux scorés (économie de tokens à la classification).
  return [...byUrl.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8);
}
