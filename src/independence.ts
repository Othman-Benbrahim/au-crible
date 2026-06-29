// Détection d'indépendance — JS déterministe, testable, sans réseau ni LLM.
// Démasque le reporting circulaire (verbatim/quasi-verbatim) : regroupe les
// candidats par domaine OU par similarité lexicale forte. Le nombre de GRAPPES
// = nombre de "voix indépendantes" (ce qui compte, pas le nombre d'URL).

import { Cluster, SearchCandidate } from "./types";

// TLD à deux niveaux les plus courants (approximation du Public Suffix List,
// suffisante pour le clustering ; on assume la limite dans l'UI).
const MULTI_TLD = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "co.jp", "or.jp", "ne.jp",
  "com.au", "net.au", "org.au", "gov.au", "edu.au", "co.nz", "com.br", "gov.br",
  "co.in", "gov.in", "com.mx", "co.za", "com.tr", "com.cn", "gov.cn",
]);

export function registrableDomain(hostname: string): string {
  const h = hostname.replace(/^www\./, "").toLowerCase();
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  const lastTwo = parts.slice(-2).join(".");
  const lastThree = parts.slice(-3).join(".");
  if (MULTI_TLD.has(lastTwo)) return lastThree;
  return lastTwo;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ensemble des trigrammes de mots (shingles) d'un texte. */
export function wordShingles(text: string, n = 3): Set<string> {
  const tokens = normalize(text).split(" ").filter(Boolean);
  const set = new Set<string>();
  if (tokens.length < n) {
    if (tokens.length) set.add(tokens.join(" "));
    return set;
  }
  for (let i = 0; i <= tokens.length - n; i++) {
    set.add(tokens.slice(i, i + n).join(" "));
  }
  return set;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Union-find : relie deux candidats si même domaine OU jaccard(extraits) > seuil. */
export function clusterCandidates(
  cands: SearchCandidate[],
  threshold: number,
): Cluster[] {
  const n = cands.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };

  const shingles = cands.map((c) => wordShingles(`${c.titre} ${c.extrait}`));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sameDomain = cands[i].domaine === cands[j].domaine;
      if (sameDomain || jaccard(shingles[i], shingles[j]) > threshold) union(i, j);
    }
  }

  const groups = new Map<number, SearchCandidate[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    (groups.get(root) ?? groups.set(root, []).get(root)!).push(cands[i]);
  }

  let k = 0;
  return [...groups.values()].map((membres) => ({
    id: `g${++k}`,
    membres,
    domaines: [...new Set(membres.map((m) => m.domaine))],
  }));
}
