import { Analyse, Cluster, ClusterClassification, Settings } from "./types";
import {
  classificationSystem, classificationUser, systemPrompt, userContent,
} from "./prompt";

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/** Extrait le premier objet/tableau JSON d'une réponse (tolère ``` et préambule). */
function parseLooseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "");
  const firstObj = cleaned.indexOf("{");
  const firstArr = cleaned.indexOf("[");
  const candidates = [firstObj, firstArr].filter((i) => i >= 0);
  if (candidates.length === 0) throw new Error("Réponse du modèle illisible (aucun JSON).");
  const start = Math.min(...candidates);
  const openChar = cleaned[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(closeChar);
  if (end <= start) throw new Error("Réponse du modèle illisible (JSON incomplet).");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export async function chatJSON<T>(
  settings: Settings, system: string, user: string, temperature: number,
): Promise<T> {
  const endpoint = settings.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model || "gpt-4o-mini",
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch {
    throw new Error("Connexion au fournisseur LLM impossible. Vérifie l'URL de l'API et ta connexion.");
  }
  const data = (await resp.json().catch(() => ({}))) as ChatResponse;
  if (!resp.ok) {
    const detail = data.error?.message ? ` (${data.error.message})` : "";
    throw new Error(`Le fournisseur LLM a renvoyé une erreur ${resp.status}${detail}.`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse vide du modèle.");
  return parseLooseJson<T>(content);
}


/** Comme chatJSON mais renvoie le texte brut du modèle (pas de parsing JSON). */
export async function chatText(
  settings: Settings, system: string, user: string, temperature: number,
): Promise<string> {
  const endpoint = settings.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model || "gpt-4o-mini",
        temperature,
        messages: [ { role: "system", content: system }, { role: "user", content: user } ],
      }),
    });
  } catch {
    throw new Error("Connexion au fournisseur LLM impossible.");
  }
  const data = (await resp.json().catch(() => ({}))) as ChatResponse;
  if (!resp.ok) {
    const detail = data.error?.message ? ` (${data.error.message})` : "";
    throw new Error(`Le fournisseur LLM a renvoyé une erreur ${resp.status}${detail}.`);
  }
  return data.choices?.[0]?.message?.content ?? "";
}

export async function analyser(
  settings: Settings, meta: { title: string; url: string }, text: string,
): Promise<Analyse> {
  return chatJSON<Analyse>(
    settings,
    systemPrompt(settings.language),
    userContent(meta.title, meta.url, text),
    settings.depth === "approfondi" ? 0.3 : 0.1,
  );
}

export async function classifyClusters(
  settings: Settings, affirmation: string, clusters: Cluster[],
): Promise<ClusterClassification[]> {
  return chatJSON<ClusterClassification[]>(
    settings,
    classificationSystem(settings.language),
    classificationUser(affirmation, clusters),
    0.1,
  );
}
