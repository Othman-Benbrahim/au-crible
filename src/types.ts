// Types partagés — V1 (analyse) + V2 (ancrage par preuves).

export type Profondeur = "rapide" | "approfondi";

export interface Settings {
  apiKey: string;
  baseUrl: string;          // endpoint compatible OpenAI
  model: string;
  language: string;
  depth: Profondeur;
  // V2 — ancrage (BYOK, 2e clé)
  tavilyApiKey: string;     // clé de recherche de l'utilisateur (palier gratuit)
  jaccardThreshold: number; // seuil de quasi-doublon, défaut 0.5
  maxClaims: number;        // affirmations ancrables max, défaut 3
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "", baseUrl: "", model: "", language: "français", depth: "rapide",
  tavilyApiKey: "", jaccardThreshold: 0.5, maxClaims: 3,
};

// --- Analyse V1 (schéma étendu pour préparer l'ancrage) ---

export type EtayageNiveau = "fort" | "moyen" | "faible" | "absent";
export type SoliditeBande =
  | "bien étayé" | "partiellement étayé" | "faiblement étayé" | "non évaluable";
export type Gravite = "mineur" | "notable" | "majeur";
export type CategorieEffet = "rhétorique" | "statistique" | "source" | "logique";
export type TypeAffirmation = "factuelle" | "statistique" | "causale" | "prediction";

export interface AffirmationCle {
  verbatim: string;    // mot pour mot dans le texte
  normalisee: string;  // proposition autonome et cherchable (entités explicites)
  entites: string[];
  verifiable: boolean; // opinion/valeur => false
  type: TypeAffirmation;
}

export interface EffetDetecte {
  nom: string;
  categorie: CategorieEffet;
  passage: string;
  explication: string;
  gravite: Gravite;
}

export interface Analyse {
  these_principale: string;
  affirmations_cles: AffirmationCle[];
  etayage: { niveau: EtayageNiveau; constat: string };
  effets_detectes: EffetDetecte[];
  solidite: { bande: SoliditeBande; justification: string };
  a_verifier: string[];
}

// --- Ancrage V2 ---

export type Intent = "neutre" | "refutation" | "primaire";

export interface SearchCandidate {
  url: string;
  domaine: string;        // domaine enregistrable (eTLD+1, approché)
  titre: string;
  extrait: string;
  date?: string;
  surfacePar: Intent[];   // intentions de requête qui l'ont fait remonter
  score?: number;
}

export interface Cluster {
  id: string;             // "g1", "g2"…
  membres: SearchCandidate[];
  domaines: string[];
}

export type Position = "soutient" | "contredit" | "nuance" | "hors-sujet";
export type TypePreuve =
  | "source primaire" | "étude/rapport" | "reportage" | "analyse/opinion" | "indéterminé";

export interface ClusterClassification {
  grappe_id: string;
  position: Position;
  type_preuve: TypePreuve;
  primaire_ou_derivee: "primaire" | "dérivée" | "indéterminé";
  specifics: boolean;
  indices_parti_pris: string[];
  confiance: number;      // 0..1
}

export interface ClusterVerdict {
  cluster: Cluster;
  classification: ClusterClassification;
  poids: number;          // crédibilité agrégée 0..1
}

export interface GroundingResult {
  affirmation: string;
  bande: string;          // jamais "vrai/faux"
  resume: string;         // "3 voix indépendantes pour, 0 contre, dont 1 primaire"
  nS: number;
  nC: number;
  primaires: number;
  reportingCirculaire: boolean;
  note?: string;
  clusters: ClusterVerdict[];
}

// --- Messages internes ---

export type Mode = "article" | "selection";
export interface AnalyzeRequest { type: "ANALYZE"; mode: Mode }
export interface GroundRequest { type: "GROUND_CLAIM"; claim: AffirmationCle }
export interface ExtractRequest { type: "CRIBLE_EXTRACT"; mode: Mode }

export interface ExtractResult {
  ok: boolean; title?: string; url?: string; text?: string; error?: string;
}
export interface AnalyzeResponse {
  ok: boolean; analyse?: Analyse; meta?: { title: string; url: string; mode: Mode }; error?: string;
}
export interface GroundResponse { ok: boolean; result?: GroundingResult; error?: string }
