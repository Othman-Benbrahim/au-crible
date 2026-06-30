# Compilation d'Au Crible (instructions pour la revue AMO)

Ce document permet de recréer une **copie exacte** du paquet soumis à partir du
code source.

## 1. Système d'exploitation et environnement

- Fonctionne sous **Linux, macOS ou Windows**.
- Outils requis : **Node.js 20 LTS ou supérieur** et **npm 10 ou supérieur**
  (npm est fourni avec Node.js).
- Aucun autre outil système n'est nécessaire : le bundler (esbuild) est installé
  localement par npm, pas globalement.

## 2. Installer Node.js et npm

- Télécharger Node.js 20 LTS depuis https://nodejs.org/ (npm inclus).
  Alternative avec nvm : `nvm install 20 && nvm use 20`.
- Vérifier les versions :
  - `node --version` → doit afficher v20.x ou plus
  - `npm --version` → doit afficher 10.x ou plus

## 3. Compilation, étape par étape

Depuis la racine du code source (le dossier contenant `package.json`) :

1. `npm ci`
   Installe les dépendances **aux versions exactes** verrouillées par
   `package-lock.json` (reproductibilité).
2. `npm run build`
   Compile le TypeScript de `src/` vers le dossier `dist/` (via esbuild).

En une seule commande, via le script fourni : `bash build.sh`

## 4. Résultat

Le dossier `dist/` produit est **le contenu exact du paquet soumis** :
`manifest.json`, `background.js`, `content.js`, `sidebar.js`, `sidebar.html`,
`options.js`, `options.html`, `sidebar.css`, `icons/`.

## 5. Précisions

- **Bundler** : esbuild, configuré dans `esbuild.config.mjs` ; version verrouillée
  dans `package-lock.json`.
- **Seule bibliothèque tierce intégrée au bundle** : `@mozilla/readability`
  (open source, licence Apache-2.0), incluse **sans modification** dans
  `content.js`. Les avertissements « innerHTML » du validateur proviennent de
  cette bibliothèque.
- Le code source (`src/*.ts`, `esbuild.config.mjs`) est écrit à la main : il n'est
  **ni transpilé, ni concaténé, ni minifié**. La transpilation et la minification
  n'ont lieu qu'à l'étape `build`, pour produire `dist/` (qui n'est pas inclus dans
  l'archive source).
