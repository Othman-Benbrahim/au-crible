// Cœur intellectuel. V1 : analyse de solidité (jamais de verdict). V2 : prompt de
// classification des sources par grappe. Le bloc "méthode" est à remplacer par le
// canon Broch complet (31 facettes + 11 effets).

import { Cluster } from "./types";

const SCHEMA_V1 = `{
  "these_principale": "string — la thèse centrale, une phrase",
  "affirmations_cles": [
    {
      "verbatim": "string — mot pour mot dans le texte",
      "normalisee": "string — proposition autonome et cherchable (pronoms/références résolus, entités explicites)",
      "entites": ["string — noms propres, dates, lieux, chiffres"],
      "verifiable": true,
      "type": "factuelle | statistique | causale | prediction"
    }
  ],
  "etayage": { "niveau": "fort | moyen | faible | absent", "constat": "string" },
  "effets_detectes": [
    { "nom": "string", "categorie": "rhétorique | statistique | source | logique",
      "passage": "string — citation EXACTE et courte", "explication": "string",
      "gravite": "mineur | notable | majeur" }
  ],
  "solidite": { "bande": "bien étayé | partiellement étayé | faiblement étayé | non évaluable",
                "justification": "string" },
  "a_verifier": ["string"]
}`;

const METHODE = `Effets et biais à repérer (référence non exhaustive) :
appel à l'autorité, appel à l'émotion, homme de paille, faux dilemme, pente glissante,
corrélation présentée comme causalité, généralisation hâtive, anecdote tenue pour preuve,
cherry-picking, effet cigogne, appel à la nature/tradition, fausse symétrie, pétition de principe.
Critères d'étayage (facettes) :
charge de la preuve, falsifiabilité, fait vs opinion, sources primaires vs secondaires,
données/méthode présentes, quantification vague, extraordinarité vs qualité des preuves.`;

export function systemPrompt(language: string): string {
  return `Tu es un analyste en lecture critique appliquant la méthode zététique (dans la lignée d'Henri Broch).

Ta mission n'est PAS de dire si le contenu est vrai ou faux : tu n'as accès à aucune source externe. Tu analyses la SOLIDITÉ du raisonnement et de l'étayage, tu repères les effets rhétoriques et biais, et tu indiques ce qu'il faudrait vérifier.

Règles impératives :
- N'émets JAMAIS de verdict "vrai", "faux" ou "vérifié". Tu évalues la solidité, pas la vérité.
- Pour chaque affirmation-clé, fournis "verbatim" (le texte exact) ET "normalisee" (une proposition autonome, cherchable, avec les entités explicitées). Mets "verifiable": false pour une opinion ou un jugement de valeur.
- Chaque effet signalé DOIT citer le passage exact (mot pour mot, court). N'invente rien.
- Reste neutre sur le fond. Écris toutes les valeurs textuelles en ${language}.

${METHODE}

Réponds UNIQUEMENT par un objet JSON valide, sans texte ni Markdown autour, conforme EXACTEMENT à ce schéma :
${SCHEMA_V1}`;
}

export function userContent(title: string, url: string, text: string): string {
  const cap = 12000;
  const body = text.length > cap ? text.slice(0, cap) + "\n[…texte tronqué…]" : text;
  return `TITRE : ${title || "(inconnu)"}\nURL : ${url || "(inconnue)"}\n\nTEXTE À ANALYSER :\n"""\n${body}\n"""`;
}

// --- V2 : classification des sources (un seul appel, groupé par affirmation) ---

export function classificationSystem(language: string): string {
  return `Tu classes des sources web par rapport à une AFFIRMATION, selon la méthode zététique.

Règles impératives :
- Juge UNIQUEMENT à partir de l'extrait fourni pour chaque grappe. N'invente rien au-delà.
- Ne conclus pas sur la vérité de l'affirmation : tu qualifies la POSITION et la QUALITÉ de chaque source.
- Si l'extrait est trop mince pour juger, baisse "confiance" (vers 0.2-0.4) et mets "indéterminé".
- "indices_parti_pris" : uniquement ce qui est visible dans l'extrait, sinon liste vide.
- Écris en ${language}.

Réponds UNIQUEMENT par un TABLEAU JSON (une entrée par grappe fournie), sans texte ni Markdown autour :
[
  {
    "grappe_id": "string (repris tel quel)",
    "position": "soutient | contredit | nuance | hors-sujet",
    "type_preuve": "source primaire | étude/rapport | reportage | analyse/opinion | indéterminé",
    "primaire_ou_derivee": "primaire | dérivée | indéterminé",
    "specifics": true,
    "indices_parti_pris": ["string"],
    "confiance": 0.7
  }
]`;
}

export function classificationUser(affirmation: string, clusters: Cluster[]): string {
  const blocs = clusters.map((c) => {
    const rep = c.membres[0];
    const extrait = (rep?.extrait ?? "").slice(0, 400);
    return `GRAPPE ${c.id}
domaines : ${c.domaines.join(", ")}
nb_sources : ${c.membres.length}
titre : ${rep?.titre ?? ""}
extrait : ${extrait}`;
  }).join("\n\n");
  return `AFFIRMATION :\n${affirmation}\n\nGRAPPES À CLASSER :\n${blocs}`;
}

// --- Mode vidéo : mise au propre du transcript + résumé/mindmap ---

export function cleanupSystem(language: string): string {
  return `Tu reçois un extrait de transcription automatique (sous-titres) d'une vidéo, souvent sans ponctuation et avec des scories.

Nettoie-le :
- ajoute ponctuation et majuscules, découpe en phrases et paragraphes lisibles ;
- retire les hésitations (euh, hum), les répétitions involontaires et les tics de langage ;
- corrige les erreurs évidentes de sous-titrage.

Règles : ne change PAS le sens, n'ajoute AUCune information, ne résume pas. Reste fidèle aux propos. Réponds uniquement par le texte nettoyé, en ${language}, sans commentaire.`;
}

export function videoSystem(language: string): string {
  return `Tu analyses la transcription horodatée d'une vidéo (chaque ligne commence par [m:ss] ou [h:mm:ss]).

Produis :
1. un résumé de 150 à 250 mots ;
2. une mindmap de 4 à 8 sections dans l'ordre de la vidéo. Pour chaque section : un titre court, le timestamp de début (repris EXACTEMENT sous la forme "m:ss" ou "h:mm:ss" d'après les marqueurs), 2 à 4 points clés, et 1 à 3 affirmations factuelles vérifiables (pas des opinions).

Écris en ${language}. Réponds UNIQUEMENT par un objet JSON valide, sans texte ni Markdown autour :
{
  "resume": "string",
  "sections": [
    {
      "titre": "string",
      "timestamp": "m:ss",
      "points": ["string"],
      "affirmations_cles": [
        { "verbatim": "string", "normalisee": "string (autonome, cherchable)", "entites": ["string"], "verifiable": true, "type": "factuelle | statistique | causale | prediction" }
      ]
    }
  ]
}`;
}

export function videoUser(titre: string, timedText: string): string {
  const cap = 16000;
  const body = timedText.length > cap ? timedText.slice(0, cap) + "\n[…transcription tronquée…]" : timedText;
  return `TITRE : ${titre}\n\nTRANSCRIPTION HORODATÉE :\n"""\n${body}\n"""`;
}
