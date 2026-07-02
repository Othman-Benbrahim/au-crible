// Récupération de sources — abstraction de fournisseur : Tavily OU Exa (jamais les
// deux). Chaque adaptateur produit le MÊME format normalisé (SearchCandidate), donc
// tout ce qui est en aval (indépendance, classification, agrégation) est inchangé.
// Appelée par affirmation isolée : réutilisable telle quelle au niveau d'un nœud de
// mindmap (fusion vidéo à venir). Aucune dépendance externe : fetch natif, jamais de SDK.

import { AffirmationCle, Intent, SearchCandidate, SearchProviderName, Settings } from "./types";
import { registrableDomain } from "./independence";

interface RawResult { url: string; title: string; content: string; date?: string; score?: number }

interface SearchProvider {
  name: SearchProviderName;
  search(query: string, maxResults: number): Promise<RawResult[]>;
}

// --- Requêtes adversariales, adaptées au fournisseur ---
// On va chercher la contradiction, pas seulement la confirmation. Exa fait de la
// recherche neuronale (regroupe par thème, pas par position) : on force donc le bord
// opposé en langage naturel long. Tavily préfère des requêtes courtes/factuelles.
export function buildQueries(
  claim: AffirmationCle, provider: SearchProviderName,
): { intent: Intent; q: string }[] {
  const base = claim.normalisee.trim();
  if (provider === "exa") {
    return [
      { intent: "neutre", q: base },
      { intent: "refutation", q: `arguments, preuves ou données qui contredisent ou réfutent cette affirmation : ${base}` },
      { intent: "primaire", q: `source primaire, étude scientifique, rapport ou données officielles concernant : ${base}` },
    ];
  }
  return [
    { intent: "neutre", q: base },
    { intent: "refutation", q: `${base} (démenti OR erreur OR controverse OR rétractation OR critique)` },
    { intent: "primaire", q: `${base} (étude OR rapport OR données OR "source originale")` },
  ];
}

function providerError(name: string, status: number): Error {
  if (status === 401) return new Error(`Clé ${name} invalide. Vérifie ta clé de recherche dans les réglages.`);
  if (status === 429) return new Error(`Quota ${name} atteint. Réessaie plus tard.`);
  return new Error(`${name} a renvoyé une erreur ${status}.`);
}

// --- Adaptateur Tavily ---
interface TavilyResult { title?: string; url?: string; content?: string; score?: number; published_date?: string }
function tavilyProvider(settings: Settings): SearchProvider {
  return {
    name: "tavily",
    async search(query, maxResults) {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: settings.tavilyApiKey,
          query,
          max_results: maxResults,
          search_depth: settings.depth === "approfondi" ? "advanced" : "basic",
          include_answer: false,
        }),
      });
      if (!resp.ok) throw providerError("Tavily", resp.status);
      const data = (await resp.json().catch(() => ({}))) as { results?: TavilyResult[] };
      return (data.results ?? []).map((r) => ({
        url: r.url ?? "", title: r.title ?? "", content: r.content ?? "",
        date: r.published_date, score: r.score,
      }));
    },
  };
}

// --- Adaptateur Exa ---
// Recherche brute uniquement (JAMAIS l'endpoint `answer`, qui synthétiserait un
// verdict et court-circuiterait le pipeline déterministe). Contenu texte borné.
interface ExaResult { title?: string; url?: string; text?: string; highlights?: string[]; score?: number; publishedDate?: string }
function exaProvider(settings: Settings): SearchProvider {
  return {
    name: "exa",
    async search(query, maxResults) {
      const resp = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": settings.exaApiKey },
        body: JSON.stringify({
          query,
          type: "auto",
          numResults: maxResults,
          contents: { text: { maxCharacters: 2000 } },
        }),
      });
      if (!resp.ok) throw providerError("Exa", resp.status);
      const data = (await resp.json().catch(() => ({}))) as { results?: ExaResult[] };
      return (data.results ?? []).map((r) => ({
        url: r.url ?? "",
        title: r.title ?? "",
        content: r.text ?? (Array.isArray(r.highlights) ? r.highlights.join(" ") : ""),
        date: r.publishedDate, score: r.score,
      }));
    },
  };
}

export function getProvider(settings: Settings): SearchProvider {
  return settings.searchProvider === "exa" ? exaProvider(settings) : tavilyProvider(settings);
}

/** Lance les 3 requêtes via le fournisseur choisi, fusionne, tague, dédoublonne. */
export async function searchClaim(
  settings: Settings, claim: AffirmationCle,
): Promise<SearchCandidate[]> {
  const provider = getProvider(settings);
  const queries = buildQueries(claim, provider.name);
  const byUrl = new Map<string, SearchCandidate>();

  for (const { intent, q } of queries) {
    let results: RawResult[] = [];
    try {
      results = await provider.search(q, 4);
    } catch (e) {
      if (intent === "neutre") throw e; // requête neutre KO => on remonte l'erreur
      continue;                          // variante KO => on tolère
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
        url: r.url, domaine, titre: r.title, extrait: r.content,
        date: r.date, surfacePar: [intent], score: r.score,
      });
    }
  }

  return [...byUrl.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8);
}
