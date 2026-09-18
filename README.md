# HAVEN — Projet 3, V1 majeure

Idle visuel : une chaîne de production visible (puits → seau → stockage →
citerne) que le joueur développe, observe et équilibre. Le spectacle EST le
jeu — pas un compteur posé sur un décor.

Projet indépendant : aucun code ni asset partagé avec FRONTIÈRES, RUPTURE ou
MURPHY.

## Boucle de jeu (V1)

- Un travailleur animé parcourt un cycle physique complet (puits → seau →
  stockage → citerne), jamais de téléportation entre postes.
- 8 familles d'amélioration à effet économique **et** visuel distinct (seau,
  déplacement, corde/treuil, puits, stockage, citerne, fréquence transport,
  productivité).
- Le goulot d'étranglement (production ou transport) se voit et se comprend
  sans ouvrir un écran de statistiques.
- Perles (méta-monnaie) + Renaissance (prestige) : bonus permanent de
  production à chaque reset volontaire, écran de confirmation explicite
  (perdu / conservé / gagné), jamais de reset accidentel.
- 8 atouts permanents universels achetés avec les Perles, valables sur toute
  map présente ou future.
- Architecture multi-maps data-driven prête ; une seule map est réellement
  autorée dans cette V1 (« La chaîne de l'eau »).
- Sauvegarde locale automatique + progression hors-ligne calculée par formule
  (plafonnée, jamais une simulation seconde par seconde), écran de retour
  honnête.
- Audio ambiant instrumental (WebAudio pur), onboarding contextuel (une
  explication par mécanique, jamais deux fois), écran d'aide.

## Stack

- JavaScript vanilla (ES modules), sans framework UI.
- Bundler : [Vite](https://vitejs.dev/).
- Moteur économique entièrement séparé du rendu (`src/engine/`), aucune
  dépendance au DOM — simulable et testable à grande vitesse.
- Persistance : `localStorage`, avec migration V0→V1.
- PWA : `manifest.webmanifest` + service worker, installable sur écran
  d'accueil.
- Hébergement : GitHub Pages, déploiement automatique via GitHub Actions à
  chaque push sur `main`.

## Structure

```
src/
  engine/
    mapDefinitions.js   définitions data-driven des maps (phases, coûts, prix)
    mapEconomy.js         moteur pur production→stockage→transport, hors-ligne
    mapUpgrades.js        achats d'améliorations de chaîne
    meta.js                Perles, atouts permanents, Renaissance
    state.js               état initial
    simulation.js          orchestration (tick/offline toutes maps, déblocage)
    migrations.js          registre de migrations de sauvegarde
    balance.js              constantes globales (plafond/efficacité hors-ligne)
  ui/
    scene.js           SVG puits/stockage/citerne/travailleur, animation par phase
    hud.js               en-tête, tiroir à onglets (chaîne / atouts)
    onboarding.js         tutoriel contextuel, une fois par mécanique
    welcomeBack.js         écran de retour honnête
    prestige.js             écran de Renaissance (perdu/conservé/gagné)
    format.js                formatage nombres/durées
  audio/audio.js       nappe instrumentale calme (WebAudio pur)
  telemetry.js          instrumentation locale (sessions, achats, saturations, prestiges)
  save.js                sauvegarde/chargement localStorage
  main.js                 assemblage, boucle principale, cycle de vie mobile
tests/                  suite node:test (économie, achats, méta, sauvegarde, migrations)
scripts/
  simulate-map1.mjs        simulations économiques requises (durée de map, goulots,
                            fenêtres hors-ligne, timing du prestige, choix d'atouts)
  check-mobile-resume.mjs  non-régression Playwright : reprise mobile, responsive,
                            idempotence du crédit hors-ligne
.github/workflows/deploy.yml
                         tests + build + test:mobile + déploiement GitHub Pages
```

## Développement local

```bash
npm install
npm run dev
```

Pour tester depuis un téléphone sur le même réseau Wi-Fi qu'un ordinateur de
développement (si vous en avez un sous la main) :

```bash
npm run dev:lan
```

Puis ouvrez l'URL `http://<IP-locale-de-l-ordinateur>:5173` affichée dans le
terminal, depuis le navigateur du téléphone connecté au même Wi-Fi.

## Tests

```bash
npm test
```

Suite `node:test` (aucune dépendance externe, 37 tests) : production,
goulots d'étranglement, achats (verrouillé / trop cher / accepté / niveau
maximum), Perles/atouts/Renaissance, calcul et plafond du crédit hors-ligne,
horloge anormale, cycles longs sans dérive, sauvegarde/migration (y compris
champs manquants).

```bash
npm run test:mobile
```

Playwright headless (buildé + servi via `vite preview`) : reprise après un
cycle suspend/resume simulé, absence de débordement horizontal à 5 largeurs
portrait, idempotence du crédit hors-ligne face à des signaux de reprise
redondants. Câblé dans la CI après le build.

```bash
npm run simulate           # V0 : profils de jeu réalistes (conservé)
node scripts/simulate-map1.mjs   # V1 : durée de map, goulots, offline, prestige, atouts
```

Résultats écrits dans `docs/haven-v0-simulation-results.json` et
`docs/haven-v1-simulation-results.json` — les chiffres des rapports viennent
de ces simulations, jamais d'une estimation à la main.

## Build de production

```bash
npm run build
npm run preview
```

## Déploiement et bêta téléphone

Le déploiement est automatique sur push vers `main` (voir
`.github/workflows/deploy.yml`). Prérequis unique côté GitHub : activer Pages
sur ce dépôt avec la source **GitHub Actions** (Settings → Pages → Build and
deployment → Source : GitHub Actions) — à faire une seule fois.

URL stable une fois activé : `https://<owner>.github.io/haven-v0/`.

**Pour tester sur le téléphone** : ouvrez cette URL dans le navigateur du
téléphone (n'importe quel Wi-Fi ou réseau mobile, aucun ordinateur requis),
puis « Ajouter à l'écran d'accueil » pour l'installer comme une app (PWA).
La sauvegarde reste locale à l'appareil.

## Rapports

- `docs/HAVEN_V0_Rapport_Technique_Officiel.pdf` — bilan de la V0.
- `docs/HAVEN_V1_Rapport_Technique_Officiel.pdf` — bilan de cette V1 majeure :
  diagnostic des bugs mobiles, architecture, simulations économiques,
  matrice de tests, limites connues, recommandations V2.
