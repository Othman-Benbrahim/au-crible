// Crédibilité par signaux (facettes Broch) + agrégation calibrée.
// 100 % JS déterministe et inspectable : la bande n'est JAMAIS un verdict de
// modèle, c'est une règle auditable. Jamais "vrai/faux".

import { ClusterClassification, ClusterVerdict, GroundingResult } from "./types";

const W_TYPE: Record<ClusterClassification["type_preuve"], number> = {
  "source primaire": 1.0,
  "étude/rapport": 0.9,
  "reportage": 0.6,
  "analyse/opinion": 0.4,
  "indéterminé": 0.3,
};

/** Poids de crédibilité 0..1, composé de signaux visibles (pas de réputation média). */
export function credibilityWeight(c: ClusterClassification): number {
  const base = W_TYPE[c.type_preuve] ?? 0.3;
  const bonusPrimaire =
    c.primaire_ou_derivee === "primaire" ? 1.0 : c.primaire_ou_derivee === "dérivée" ? 0.8 : 0.9;
  const bonusSpecifics = c.specifics ? 1.0 : 0.85;
  const penalite = Math.min(0.3, 0.1 * (c.indices_parti_pris?.length ?? 0));
  const conf = Math.max(0, Math.min(1, c.confiance ?? 0.5));
  return base * bonusPrimaire * bonusSpecifics * (1 - penalite) * conf;
}

const SEUIL_PRISE_EN_COMPTE = 0.35; // une grappe pèse si poids >= ce seuil
const SEUIL_FORT = 0.6;

export function aggregate(affirmation: string, verdicts: ClusterVerdict[]): GroundingResult {
  const retenues = verdicts.filter((v) => v.poids >= SEUIL_PRISE_EN_COMPTE);
  const soutiens = retenues.filter((v) => v.classification.position === "soutient");
  const contre = retenues.filter((v) => v.classification.position === "contredit");

  const nS = soutiens.length;
  const nC = contre.length;
  const primaires = soutiens.filter(
    (v) => v.classification.primaire_ou_derivee === "primaire"
      || v.classification.type_preuve === "source primaire",
  ).length;

  // Reporting circulaire : plusieurs URL fondues en une seule voix.
  const reportingCirculaire = verdicts.some((v) => v.cluster.membres.length >= 3);

  const total = nS + nC;
  let bande: string;
  let note: string | undefined;

  if (total < 2) {
    bande = "Sources insuffisantes";
    note = "Corroboration indépendante insuffisante — ne pas conclure.";
  } else if (nC === 0 && nS >= 3 && primaires >= 1) {
    bande = "Bien corroboré (voix indépendantes concordantes)";
  } else if (nC === 0 && nS >= 2) {
    bande = "Plutôt corroboré";
  } else if (nS > 0 && nC > 0) {
    bande = "Contesté — sources divergentes";
  } else if (nS === 0 && nC >= 2) {
    bande = "Plutôt contredit";
  } else {
    bande = "Sources insuffisantes";
    note = "Signaux trop faibles pour conclure.";
  }

  // Suffixe "sources faibles" si aucune grappe de soutien n'est solide.
  if (nS > 0 && soutiens.every((v) => v.poids < SEUIL_FORT) && bande.startsWith("Plutôt corrobor")) {
    bande += " (sources faibles)";
  }

  const resume =
    `${nS} voix indépendante${nS > 1 ? "s" : ""} pour, ${nC} contre`
    + (primaires > 0 ? `, dont ${primaires} primaire${primaires > 1 ? "s" : ""}` : "");

  return { affirmation, bande, resume, nS, nC, primaires, reportingCirculaire, note, clusters: verdicts };
}
