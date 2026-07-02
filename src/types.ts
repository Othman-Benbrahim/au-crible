// Types partagés — V1 (analyse) + V2 (ancrage par preuves).

export type Profondeur = "rapide" | "approfondi";
export type SearchProviderName = "tavily" | "exa";

export interface Settings {
  apiKey: string;
  baseUrl: string;          // endpoint compatible OpenAI
  model: string;
  language: string;
  depth: Profondeur;
  // V2 — ancrage (BYOK, 2e clé)
  searchProvider: SearchProviderName; // moteur de recherche : l'un OU l'autre
  tavilyApiKey: string;     // clé Tavily (palier gratuit)
  exaApiKey: string;        // clé Exa (palier gratuit, sans carte)
  jaccardThreshold: number; // seuil de quasi-doublon, défaut 0.5
  maxClaims: number;        // affirmations ancrables max, défaut 3
  transcriptLangs: string[]; // langues de sous-titres préférées (mode vidéo)
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "", baseUrl: "", model: "", language: "français", depth: "rapide",
  searchProvider: "tavily", tavilyApiKey: "", exaApiKey: "",
  jaccardThreshold: 0.5, maxClaims: 3, transcriptLangs: ["fr", "en"],
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

// --- Mode vidéo (YouTube) ---

export interface TranscriptSegment {
  start: number; // secondes
  dur: number;
  text: string;
}

export interface VideoSection {
  id: string;
  titre: string;
  timestamp: number;              // secondes, pour le seek
  points: string[];
  affirmations_cles: AffirmationCle[]; // pour l'ancrage par nœud (réutilise groundClaim)
}

export interface VideoAnalysis {
  videoId: string;
  titre: string;
  resume: string;
  sections: VideoSection[];
  transcriptPropre: { t: number; texte: string }[]; // paragraphes horodatés, nettoyés
}

// Messages du mode vidéo
export interface VideoAnalyzeRequest { type: "VIDEO_ANALYZE" }
export interface VideoAnalyzeResponse { ok: boolean; analysis?: VideoAnalysis; error?: string }
export interface YtSeekRequest { type: "YT_SEEK"; seconds: number }
