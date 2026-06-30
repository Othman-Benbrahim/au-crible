#!/usr/bin/env bash
# Script de compilation d'Au Crible — exécute toutes les étapes préalables
# pour produire le paquet dans dist/.
set -e

echo "== Versions =="
echo "node : $(node --version)"
echo "npm  : $(npm --version)"

echo "== Installation des dépendances (versions verrouillées) =="
npm ci

echo "== Compilation =="
npm run build

echo "== Terminé : le paquet est dans dist/ =="
