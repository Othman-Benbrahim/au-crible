# Politique de confidentialité — Au Crible

**Dernière mise à jour : 2026-06-29**

## En résumé

Au Crible n'a **aucun serveur**. L'éditeur ne reçoit, ne stocke et ne voit
**aucune** de tes données. Tout se passe dans ton navigateur. Tes clés et tes
réglages restent sur ton appareil. Le contenu que tu fais analyser n'est envoyé
qu'aux fournisseurs que **tu** as toi-même configurés, avec **tes** clés, et
uniquement lorsque tu cliques.

## 1. Éditeur

Au Crible est édité par Othman Ben Brahim.
Contact : othman.benbrahim@ikmail.com

## 2. Ce que l'extension ne fait pas

- Aucun serveur de l'éditeur : l'éditeur ne reçoit aucune donnée.
- Aucune télémétrie, aucune statistique d'usage, aucun pistage, aucun cookie.
- Aucune publicité.
- Aucune vente, location ni partage de données à des fins commerciales.
- Aucune analyse automatique : rien n'est traité tant que tu n'as pas cliqué.

## 3. Données traitées, et qui les reçoit

**Réglages et clés d'API** (clé du fournisseur LLM, clé de recherche Tavily,
langue, seuils). Stockés **localement** sur ton appareil via l'API de stockage du
navigateur. Ils ne sont jamais transmis à l'éditeur.

**Contenu de la page ou texte sélectionné.** Quand tu lances une analyse, le texte
de l'article (ou ta sélection) est extrait localement, puis envoyé **au fournisseur
LLM que tu as configuré** (ex. Groq, Google AI Studio, OpenRouter…), avec ta clé,
pour produire l'analyse.

**Vérification des sources** (fonction optionnelle). Quand tu cliques sur « Vérifier
les sources », l'affirmation reformulée est envoyée à **Tavily** sous forme de
requêtes de recherche ; les extraits de résultats obtenus, accompagnés de
l'affirmation, sont ensuite envoyés au **fournisseur LLM** pour classification.

Ces envois n'ont lieu que sur **ton action explicite**.

## 4. Fournisseurs tiers

Tu choisis librement tes fournisseurs (LLM et recherche). Les données que l'extension
leur transmet sont régies par **leurs propres politiques de confidentialité**, que tu
es invité·e à consulter avant de saisir tes clés. Au Crible ne fait que relayer ta
requête vers l'adresse (endpoint) que tu as configurée, avec ta clé ; l'éditeur n'est
pas intermédiaire de ces échanges.

## 5. Conservation des données

- **Clés et réglages** : conservés localement jusqu'à ce que tu les effaces ou que tu
  désinstalles l'extension (la désinstallation supprime le stockage local).
- **Résultats d'analyse** : affichés dans le panneau, **non enregistrés**. Ils
  disparaissent à la fermeture du panneau ou du navigateur.

## 6. Permissions demandées, et pourquoi

- **storage** : enregistrer tes réglages et tes clés, localement.
- **activeTab** et **scripting** : lire le contenu de l'onglet courant, uniquement
  quand tu déclenches une analyse.
- **permissions d'hôte optionnelles** : accordées par toi, fournisseur par
  fournisseur, au moment où tu enregistres une clé — afin d'autoriser l'appel réseau
  vers l'adresse que tu as choisie.

## 7. Sécurité

Tes clés sont conservées via l'API de stockage du navigateur. Comme toute donnée
locale, leur protection dépend de la sécurité de ton appareil et de ton profil
navigateur. Ne saisis tes clés que sur un appareil de confiance.

## 8. Public

Au Crible est un outil grand public d'aide à la lecture critique. Il n'est pas
destiné aux enfants et ne collecte sciemment aucune donnée les concernant.

## 9. Modifications

Cette politique peut évoluer. Toute modification sera indiquée par la date en tête de
ce document.

## 10. Contact

Pour toute question : othman.benbrahim@ikmail.com
