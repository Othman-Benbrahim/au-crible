// Orchestrateur d'ancrage pour UNE affirmation (étapes 2→7).
// Un seul appel LLM ajouté (classification), le reste est déterministe.

import { aggregate, credibilityWeight } from "./aggregate";
import { clusterCandidates } from "./independence";
import { classifyClusters } from "./llm";
import { searchClaim } from "./search";
import { AffirmationCle, ClusterVerdict, GroundingResult, Settings } from "./types";

export async function groundClaim(
  settings: Settings, claim: AffirmationCle,
): Promise<GroundingResult> {
  // 3 — récupération
  const candidates = await searchClaim(settings, claim);
  if (candidates.length === 0) {
    return {
      affirmation: claim.normalisee, bande: "Sources insuffisantes",
      resume: "0 voix indépendante pour, 0 contre",
      nS: 0, nC: 0, primaires: 0, reportingCirculaire: false,
      note: "Aucune source trouvée pour cette affirmation.", clusters: [],
    };
  }

  // 4 — indépendance (JS)
  const clusters = clusterCandidates(candidates, settings.jaccardThreshold);

  // 5 — classification (1 appel LLM, groupé)
  const classifications = await classifyClusters(settings, claim.normalisee, clusters);
  const byId = new Map(classifications.map((c) => [c.grappe_id, c]));

  // 6 — crédibilité par signaux (JS)
  const verdicts: ClusterVerdict[] = clusters.map((cluster) => {
    const classification = byId.get(cluster.id) ?? {
      grappe_id: cluster.id, position: "hors-sujet", type_preuve: "indéterminé",
      primaire_ou_derivee: "indéterminé", specifics: false, indices_parti_pris: [], confiance: 0.2,
    };
    return { cluster, classification, poids: credibilityWeight(classification) };
  });

  // 7 — agrégation calibrée (JS)
  return aggregate(claim.normalisee, verdicts);
}
