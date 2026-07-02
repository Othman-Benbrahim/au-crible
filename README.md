# Au Crible — lecture critique zététique (extension Firefox)

Passe au crible l'article que tu lis. **V1 (analyse)** : thèse, affirmations-clés,
étayage, effets rhétoriques & biais en contexte, solidité calibrée, points à
vérifier — jamais de verdict vrai/faux. **V2 (ancrage, cette version)** : pour
chaque affirmation vérifiable, un bouton « Vérifier les sources » recherche le web,
démasque le reporting circulaire, et rend une corroboration **calibrée et pondérée
par l'indépendance** des sources.

## Principe : aucun backend, aucune dépendance que tu paies

Tout tourne côté client, en BYOK (tu apportes tes clés). Deux clés, deux coûts qui
te sont étrangers :
- **LLM** (analyse + classification) : endpoint compatible OpenAI.
- **Recherche** (ancrage V2) : **Tavily ou Exa** (au choix, jamais les deux) —
  chacun avec un palier gratuit ~1000 requêtes/mois sans carte. Tavily = extraits
  courts et factuels ; Exa = recherche neuronale, textes plus longs. Les requêtes de
  réfutation sont adaptées à chaque moteur.

Tu n'héberges rien, tu ne paies rien, rien ne transite par un serveur intermédiaire.

## Le pipeline d'ancrage (V2)

Un **seul** appel LLM ajouté au-delà de la V1 ; tout le reste est du JS déterministe.

| Étape | Où | Rôle |
|------|----|------|
| 1. Affirmations cherchables | LLM (appel V1 étendu) | `verbatim` + `normalisee` + entités + `verifiable` |
| 2. Requêtes adversariales | JS (gabarits) | confirmation **et** réfutation **et** source primaire |
| 3. Récupération | Tavily **ou** Exa | candidats tagués par intention, dédoublonnés |
| 4. Indépendance | JS déterministe | trigrammes + Jaccard + `eTLD+1` → **voix** (pas URL) |
| 5. Classification | LLM (1 appel groupé) | position / type de preuve / primaire / parti pris / confiance |
| 6. Crédibilité | JS | poids par **signaux** (facettes Broch), jamais par réputation média |
| 7. Agrégation | JS inspectable | bandes calibrées, jamais vrai/faux, aveu « sources insuffisantes » |

Modules : `search.ts` (étapes 2-3), `independence.ts` (4), `llm.ts`+`prompt.ts` (1,5),
`aggregate.ts` (6-7), `grounding.ts` (orchestration). Les modules 4, 6 et 7 sont du
JS pur, sans réseau ni LLM — donc testables hors-ligne.

## Réglages

- **Jaccard** (défaut 0.5) : seuil de quasi-doublon. Plus haut = rate des reprises ;
  plus bas = fusionne à tort des sources distinctes. À ajuster sur de vrais résultats.
- **Affirmations ancrables max** (défaut 3) : borne le quota du moteur
  (~3 requêtes/affirmation → ~110 analyses ancrées/mois sur le palier gratuit).

## Compilation

Voir **BUILD.md** pour les instructions complètes de compilation (revue AMO).
En bref : `npm ci` puis `npm run build` (ou `bash build.sh`).

## Charger dans Firefox

1. `npm install` puis `npm run build` → `dist/`.
2. `about:debugging#/runtime/this-firefox` → **Charger un module temporaire** → `dist/manifest.json`.
3. Clique l'icône **Au Crible** (ouvre le panneau, autorise la page).
4. **Réglages** : clé LLM (Groq / Google AI Studio / OpenRouter) ; et, pour l'ancrage,
   clé de recherche (Tavily ou Exa).
5. Sur un article → **Passer au crible** → puis « Vérifier les sources » sur une affirmation.


## Mode vidéo YouTube

Sur une page `/watch`, le mode **Vidéo** récupère les sous-titres horodatés, produit
via l'IA un **transcript propre**, un **résumé** et une **mindmap** dont chaque nœud
est horodaté. Clique un titre → la vidéo saute au passage (seek). Bouton **« Vérifier
cette section »** → ancrage par nœud (réutilise le pipeline Tavily/Exa). Export de la
note complète en **Markdown** (`.md`). Le transcript est nettoyé par tronçons pour
tenir quelle que soit la durée.

## Limites assumées

- Mode vidéo : dépend des sous-titres YouTube (`ytInitialPlayerResponse`) ; si YouTube change sa page, l'acquisition peut casser. Sans sous-titres, pas d'analyse.

- L'indépendance par Jaccard attrape le verbatim / quasi-verbatim, **pas** la
  reformulation d'une même dépêche ni une source amont commune non citée. D'où
  « indices d'indépendance », jamais « preuve ».
- La classification lit l'extrait Tavily, pas l'article entier → la confiance et la
  transparence couvrent l'erreur possible.
- `eTLD+1` est approché (liste de suffixes courte), suffisant pour le clustering.
- Le bloc méthode de `prompt.ts` est condensé : à remplacer par le canon Broch complet.
