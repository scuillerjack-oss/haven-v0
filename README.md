# HAVEN — Projet 3, V0

Idle visuel : un petit monde miniature qui se restaure sous vos yeux. Pas de
compteur-spectacle — c'est le monde qui se transforme qui est le jeu.

Projet indépendant : aucun code ni asset partagé avec FRONTIÈRES, RUPTURE ou
MURPHY.

## Boucle de jeu (V0)

- Une scène unique : une source, un sol, une flore, une faune — 4 systèmes de
  production maximum, chacun débloqué par la vitalité cumulée du monde.
- 2 interactions principales : toucher la source pour puiser de l'eau (geste
  actif), ouvrir le tiroir du bas pour acheter l'une des 15 améliorations
  nommées (jamais de simple +10 %).
- 7 paliers visuels cumulatifs (terre stérile → havre vivant), chacun modifie
  visiblement la scène.
- Sauvegarde locale automatique (`localStorage`) + progression hors-ligne
  plafonnée (4h, 8h avec l'amélioration "Rosée nocturne"), clairement
  expliquée au retour dans un écran « Bon retour ».
- Audio ambiant instrumental généré en WebAudio (pas de fichier à charger),
  mute/volume fonctionnels.

## Stack

- JavaScript vanilla (ES modules), sans framework UI.
- Bundler : [Vite](https://vitejs.dev/).
- Rendu de la scène : un seul SVG dont les calques se révèlent
  progressivement (pas d'échange brutal d'image).
- Persistance : `localStorage`.
- PWA : `manifest.webmanifest` + service worker, installable sur écran
  d'accueil.
- Hébergement : GitHub Pages, déploiement automatique via GitHub Actions à
  chaque push sur `main`.

## Structure

```
src/
  engine/
    balance.js       toutes les constantes d'équilibrage (paliers, coûts, taux)
    state.js          état initial
    simulation.js     production, tap, achats, calcul hors-ligne
    migrations.js     registre de migrations de sauvegarde entre versions
  ui/
    scene.js           calques SVG + révélation par palier
    hud.js               en-tête, tiroir d'améliorations
    onboarding.js        3 indices contextuels maximum
    welcomeBack.js        écran de retour honnête (durée, gain, plafond, paliers traversés)
    format.js             formatage nombres/durées
  audio/audio.js       nappe instrumentale calme (WebAudio pur)
  telemetry.js          instrumentation locale (sessions, paliers, retours)
  save.js                sauvegarde/chargement localStorage
  main.js                 assemblage, boucle principale, interactions
tests/                  suite node:test (production, achats, sauvegarde,
                         hors-ligne + plafonds, migrations)
scripts/simulate-progression.mjs
                         simulation de plusieurs profils de jeu réalistes
                         (sessions + fermeture de l'app entre deux), pour
                         mesurer le temps réel jusqu'à chaque palier
.github/workflows/deploy.yml
                         tests + build + déploiement GitHub Pages
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

Suite `node:test` (aucune dépendance externe) : production et calcul du
taux, tap, achats (verrouillé / trop cher / accepté / niveau maximum),
amélioration globale unique, détection des paliers traversés, calcul et
plafond du crédit hors-ligne (y compris survie à une absence de 48 à 72h),
sauvegarde/chargement, reprise après rechargement, rejet propre d'une
sauvegarde corrompue ou d'une version future inconnue.

```bash
npm run simulate
```

Rejoue 4 profils de jeu réalistes (léger, modéré, assidu, onglet laissé
ouvert sans jamais rien acheter) et écrit
`docs/haven-v0-simulation-results.json` — les chiffres du rapport V0 viennent
de cette simulation, jamais d'une estimation à la main.

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
