# HAVEN — Prototype de direction artistique
### Rapport technique — épreuve visuelle (branche `visual-prototype`)

**Ceci n'est pas HAVEN V6.** Ce document rapporte le résultat d'une expérimentation isolée dont la seule question était : *« Sommes-nous capables d'amener HAVEN jusqu'au niveau de qualité visuelle recherché ? »* Le moteur économique, les sauvegardes et HAVEN V5 (déployé, branche `main`) n'ont pas été touchés.

---

## 1. Audit de départ et isolation

- État réel vérifié avant toute modification : `main` à `5877c02` (HEAD = `origin/main`, working tree propre, dernier commit = rapport officiel V5).
- Travail réalisé exclusivement sur une branche dédiée `visual-prototype`, créée depuis ce commit.
- Vérification finale : `git diff main -- src/` est vide. Aucune ligne de HAVEN V5 (moteur, scène SVG, style, save) n'a été modifiée.
- Suite de tests automatisés (`npm test`) : **73/73 passent**, inchangée.

## 2. Analyse de l'image de référence

L'image de référence est une illustration peinte (style « jeu mobile premium ») : puits en pierre avec profondeur et éclairage porté, réserve/citerne en bois cerclé de métal avec reflets, citerne-camion avec carrosserie modelée, fermier en silhouette 3/4 avec anatomie cohérente, végétation dense (haie fleurie au premier plan, arbres, collines, village lointain, pont), hiérarchie de plans très marquée (premier plan flouté/sombre → sujet net → arrière-plan atmosphérique), lumière du jour cohérente sur tous les éléments. C'est un rendu **peint**, pas un assemblage de formes vectorielles.

## 3. Choix technique : abandon du SVG/CSS plat pour du Canvas 2D procédural

V5 avait déjà identifié le SVG/CSS plat comme un plafond. Pour ce prototype, chaque asset (fermier, puits, réserve, camion, décor) est redessiné en **Canvas 2D**, exporté en PNG transparent (`prototype-visual/sprite-forge.html` → `gen-sprites.mjs` → `sprites/*.png`), puis composé dans une scène HTML (`prototype.html`) qui réutilise **le vrai moteur** (`src/engine/state.js`, `simulation.js`, `mapDefinitions.js`, `mapEconomy.js`) : la boucle économique affichée (puits → seau → réserve → camion) est authentique, seul le rendu change.

Ce choix a été fait faute de mieux dans l'environnement disponible : aucun outil de génération d'image, aucune bibliothèque d'illustration (`node-canvas`, etc.) n'était accessible — seul du code Canvas 2D exécuté en Chromium headless (Playwright). Le Canvas 2D permet des dégradés multi-stops, des ombres de contact douces, du bruit de texture clippé à la silhouette : un vocabulaire que le SVG plat de V5 n'avait pas, mais qui reste fondamentalement un rendu **vectoriel à plat de couleur**, pas un rendu peint.

## 4. Itérations réelles effectuées (pas de micro-corrections)

**Fermier — le point critique du brief.** Un premier essai anatomique a produit un personnage illisible : un torse unique en « goutte » englobant les bras, une tête décentrée, un chapeau désaxé — visuellement un blob avec un chapeau, pas un fermier. Diagnostic : le torse était dessiné en pleine largeur (34–40px de rayon), ce qui enterrait les bras À L'INTÉRIEUR de la silhouette au lieu de les laisser dépasser. Correction réelle (pas cosmétique) :
- Torse redessiné en trapèze étroit (épaule 25px, taille 17px) au lieu d'un blob plein.
- Bras rattachés à l'EXTÉRIEUR de la silhouette du torse, avec une rotule d'épaule et une rotule de coude visibles (cercles à dégradé) pour que le membre se lise comme articulé.
- Résultat vérifié par rendu : les 3 poses (marche, puisage, versement) sont maintenant chacune lisibles comme un humain qui porte un seau, se penche vers le puits, ou verse dans la réserve — voir `captures/farmer_*_solo.png`.

**Scène composée — profondeur et richesse du décor.** Un premier assemblage complet a révélé, une fois comparé côte à côte à V5, que la bande de collines vertes du décor était placée sous la couture avec le sol et donc **entièrement invisible** — le prototype paraissait plus pauvre que V5 (dirt plat, montagnes grises, aucune végétation). Correction : remontée de la bande de collines, ajout de deux arbres (dégradé radial pour le volume de la ramure) et d'un hameau lointain à trois toits sur la rive du lac, et réduction de la hauteur du calque de sol (46 % → 36 %) pour laisser cette bande apparaître. Un mur de pierre + fleurs au tout premier plan avait déjà été ajouté pour introduire un 3e plan de profondeur (absent de la toute première composition, qui n'avait que décor + sol).

**Bug de lisibilité corrigé en cours de route :** le calque de premier plan (`z-index: 5`) passait au-dessus du HUD et du texte de phase (`z-index` implicite), les rendant illisibles — corrigé en donnant à `.hud`/`.caption` un `z-index` supérieur.

**Rebond de marche du fermier :** implémenté en pliant une sinusoïde directement dans le même `transform` JS par frame que la position/l'orientation (jamais une classe CSS séparée sur la même propriété, jamais une propriété de mise en page comme `margin-bottom`) — leçon directement reprise du bug de saccade du camion identifié pendant la mission V5.

## 5. Auto-critique honnête (comparaison directe avec la référence)

Voir `captures/comparison_reference_v5_prototype.png` (référence / V5 / prototype côte à côte, même cadrage).

1. **Assemblage de formes plates ?** Non, plus au sens de V5 (dégradés, ombres, texture réelle), mais oui au sens large : la technique reste du remplissage vectoriel à plat, pas de la peinture.
2. **Fermier plat/déformé selon l'angle ?** Corrigé pour les 3 poses testées (rendu isolé lisible). Non re-testé : le retournement gauche/droite reste un `scaleX` CSS sur une seule pose canonique asymétrique (pas des vues indépendantes dessinées) — à l'échelle de jeu réelle (~14 % de la largeur de scène), le détail anatomique est de toute façon à peine perceptible à l'œil.
3. **Volume réel des objets ?** Oui, modeste : puits (pierre) et réserve (bois/métal) ont des dégradés multi-stops et des ombres de contact ; le camion n'a pas pu être réévalué en situation (trop petit/en bord de cadre dans les captures obtenues).
4. **Même univers graphique ?** Globalement oui (palette terre chaude cohérente, même vocabulaire de dégradé partout), mais de façon un peu générique plutôt que par une direction artistique distinctive.
5. **Terrain peint ou rempli ?** Amélioré (grain clippé + chemin usé + cailloux) mais reste lisiblement une texture procédurale, pas un sol « construit ».
6. **Matériaux différenciables ?** Oui par la couleur/le dégradé (pierre / bois / métal / tissu), pas par un rendu de matière réel (spéculaire, rugosité).
7. **Ombres et contacts sol cohérents ?** Oui, lumière implicite unique (haut-gauche) appliquée partout, ombres de contact douces sous chaque élément posé.
8. **Profondeur perceptible immédiatement ?** Oui, 3 plans désormais nets (arrière-plan montagnes/lac/hameau, plan de jeu, premier plan mur+fleurs).
9. **Capture suffisamment jolie pour une fiche Google Play ?** Honnêtement non : le résultat est un « flat design » de jeu mobile propre et cohérent, pas un visuel qui se démarquerait sur une fiche store à côté de jeux à direction artistique peinte.
10. **L'écart resterait-il immédiatement énorme à côté de la référence ?** **Oui.** Voir la comparaison. Sans ambiguïté.

Conformément au brief : la réponse « oui » à la question 10 signifie que cette mission n'est **pas** considérée comme un succès de rupture visuelle simplement parce que le code fonctionne.

## 6. Diagnostic honnête de plafond (section 14 du brief)

**Le plafond est réel et il est atteint.** Deux itérations substantielles ont été menées (anatomie du fermier, profondeur/richesse du décor), chacune a produit une amélioration réelle et vérifiable — mais l'écart catégoriel avec la référence n'a pas bougé, parce qu'il ne s'agit pas d'un défaut ponctuel corrigible : c'est un écart de **méthode de production**.

- **Ce qui limite :** produire un rendu peint (lumière qui rebondit entre objets, brossage de matière, densité de détail environnemental à la main) en écrivant des coordonnées de courbes de Bézier et des dégradés par code n'est pas la même discipline que l'illustration/la peinture. Chaque point de qualité supplémentaire coûte disproportionnellement plus de réglages manuels de géométrie, avec une asymptote réelle : le remplissage procédural ne peut pas imiter la peinture.
- **Pourquoi il existe ici précisément :** cet environnement ne fournit aucun outil de génération d'image, et aucun outil d'illustration/dessin vectoriel avec retour visuel interactif (type Illustrator/Procreate) — seule la boucle « écrire du code de dessin → l'exécuter en headless → inspecter le PNG résultant » était disponible.
- **Ce qu'il faudrait pour dépasser ce plafond :** soit un illustrateur/artiste 2D humain produisant les assets cibles en PNG/WebP transparent au bon style (l'architecture de composition construite ici — moteur réel + calques + sprites transparents — les accueillerait directement, sans rien reconstruire), soit un modèle de génération d'image prompté par asset (fermier par pose, puits, camion, décor), absent de la panoplie d'outils de cette session.
- **Ce qui est raisonnablement atteignable avec les outils actuels :** exactement ce qui a été livré — un style « flat design » propre, cohérent, avec une vraie hiérarchie de plans et une anatomie de personnage lisible et déployable tel quel.
- **Ce qui n'est PAS atteignable ainsi :** le niveau de finition peint de la référence, dans ce pipeline (code → Canvas 2D → PNG), quel que soit le nombre d'itérations supplémentaires de même nature.

## 7. Statut final

**FAIT**
- Sprite forge Canvas 2D (fermier ×3 poses, puits, réserve, camion, arrière-plan, sol, premier plan) — `prototype-visual/sprite-forge.html` + `gen-sprites.mjs`.
- Scène composée branchée sur le vrai moteur économique — `prototype-visual/prototype.html`.
- Réécriture de l'anatomie du fermier (torse/bras) après diagnostic du blob initial.
- Ajout d'un 3e plan de profondeur (mur + fleurs) et enrichissement du plan lointain (collines, arbres, hameau) après auto-critique comparative avec V5.
- Correctif de lisibilité (z-index HUD/caption).
- Rebond de marche implémenté sans propriété de mise en page (leçon V5 réappliquée).

**TESTÉ**
- `npm test` : 73/73 (moteur HAVEN V5 non affecté).
- `git diff main -- src/` vide (aucune régression possible sur V5).
- Rendu Playwright/Chromium headless sans erreur console/page sur la scène composée, aux 3 phases capturées (marche, puisage, versement).

**DÉPLOYÉ**
- Rien. Ce prototype n'a volontairement **pas** été déployé sur l'URL publique de HAVEN — il reste une expérimentation isolée sur `visual-prototype`, conformément au mandat de la mission.

**NON VÉRIFIÉ**
- Rendu réel sur un téléphone Android physique (jugement humain, jamais simulé par les tests automatisés).
- Le camion en situation dans la scène composée (trop petit/en bord de cadre dans les captures obtenues ; sa qualité de volume n'a été vérifiée qu'isolément).
- Si un illustrateur humain ou un modèle de génération d'image appliqué à cette même architecture de composition (moteur réel + calques + sprites transparents) suffirait à combler l'écart — ce diagnostic est une hypothèse de méthode, pas un test réalisé.
