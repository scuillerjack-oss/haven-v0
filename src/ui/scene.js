// Scène de la Map 1 (V4 : rupture visuelle post-bêta V3, cahier des
// charges V4 section 2-4). Toujours un seul SVG, un seul fermier, la même
// mécanique de phases pilotée par le moteur — mais une composition
// beaucoup plus riche (ciel, montagnes, lac, collines, haie, poule,
// charrette) et EXACTEMENT deux seaux fonctionnels :
//   - Seau A (puits) : attaché au mécanisme du puits, descend/remonte
//     dans la margelle, ne quitte jamais le puits.
//   - Seau B (fermier) : un seul seau personnel, toujours visible sur le
//     fermier, ne descend jamais dans le puits, change juste d'apparence
//     (vide/plein) et accompagne le corps pendant la marche.
// Aucun tuyau fixe : le trajet du fermier EST le gameplay visible.

const HOME_X = 150;
const WELL_X = 70;
const STORAGE_X = 230;
const TRUCK_DOCK_X = 300;
const TRUCK_HIDDEN_X = 420;
// Durée réelle (ms) de la phase de départ scriptée du camion — voir le
// commentaire détaillé dans updateSceneAnimation().
const TRUCK_DEPART_MS = 1100;
let departStartAt = null;

export function sceneMarkup() {
  return `
    <svg class="haven-scene" viewBox="0 0 400 520" role="img" aria-label="La chaîne de l'eau" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="sky-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#bfe3f2" />
          <stop offset="55%" stop-color="#dff0e0" />
          <stop offset="100%" stop-color="#eef6dd" />
        </linearGradient>
        <linearGradient id="lake-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a9d8e6" />
          <stop offset="100%" stop-color="#8dc3d8" />
        </linearGradient>
        <clipPath id="storage-clip">
          <rect x="-30" y="-96" width="60" height="98" />
        </clipPath>
      </defs>

      <rect class="scene-sky" x="0" y="0" width="400" height="520" />

      <!-- Arrière-plan de campagne (décoratif, jamais superposé aux
           éléments fonctionnels — voir la zone garantie libre au-dessus
           de y=260, vérifiée par mesure réelle des rendus). -->
      <g class="scenery" aria-hidden="true">
        <path class="mountain mountain-back" d="M-10 190 L60 90 L130 190 Z" />
        <path class="mountain mountain-back" d="M110 195 L190 70 L270 195 Z" />
        <path class="mountain mountain-front" d="M180 200 L245 120 L310 200 Z" />
        <path class="mountain mountain-front" d="M270 205 L330 130 L400 205 L400 210 L270 210 Z" />

        <ellipse class="lake" cx="200" cy="222" rx="120" ry="20" />
        <path class="lake-shine" d="M120 222 Q160 216 200 222 T280 222" />

        <g class="village" transform="translate(200, 196)">
          <path class="village-hill" d="M-70 20 Q0 -6 70 20 Z" />
          <g class="village-house" transform="translate(-28,10)"><rect x="-5" y="-8" width="10" height="8" /><polygon points="-6,-8 6,-8 0,-14" /></g>
          <g class="village-house" transform="translate(-8,13)"><rect x="-4" y="-6" width="8" height="6" /><polygon points="-5,-6 5,-6 0,-11" /></g>
          <g class="village-house village-house-spire" transform="translate(14,9)"><rect x="-4" y="-11" width="8" height="11" /><polygon points="-4,-11 4,-11 0,-19" /></g>
          <g class="village-house" transform="translate(34,13)"><rect x="-4" y="-6" width="8" height="6" /><polygon points="-5,-6 5,-6 0,-11" /></g>
        </g>

        <path class="hill hill-back" d="M0 258 Q100 175 220 210 T400 190 L400 380 L0 380 Z" />
        <path class="hill hill-front" d="M0 300 Q140 232 260 258 T400 244 L400 380 L0 380 Z" />

        <g class="tree" transform="translate(112, 252)">
          <rect x="-3" y="-24" width="6" height="24" class="tree-trunk" />
          <circle cx="0" cy="-32" r="17" class="tree-canopy" />
          <circle cx="-11" cy="-25" r="12" class="tree-canopy" />
          <circle cx="11" cy="-27" r="13" class="tree-canopy" />
        </g>
        <g class="tree tree-small" transform="translate(312, 238)">
          <rect x="-2.5" y="-19" width="5" height="19" class="tree-trunk" />
          <circle cx="0" cy="-25" r="13" class="tree-canopy" />
          <circle cx="-8" cy="-19" r="9" class="tree-canopy" />
        </g>

        <g class="signpost" transform="translate(290, 250)">
          <rect x="-2" y="-30" width="4" height="30" class="signpost-pole" />
          <rect x="-16" y="-42" width="32" height="16" rx="2" class="signpost-board" />
          <path class="signpost-leaf" d="M0 -34 q6 -4 0 -8 q-6 4 0 8 Z" />
        </g>
      </g>

      <path class="scene-ground" d="M0 380 L400 380 L400 520 L0 520 Z" />
      <path class="scene-path" d="M20 380 Q150 370 400 377 L400 386 Q150 380 20 388 Z" />

      <!-- Haie basse + fleurs : bordure vivante du chemin, jamais sur la
           trajectoire du fermier ni des éléments fonctionnels. -->
      <g class="hedge" aria-hidden="true">
        <g class="flower" transform="translate(140,392)"><circle r="3" class="flower-petal" /><circle cx="4" cy="-1" r="3" class="flower-petal" /><circle cx="-1" cy="-4" r="3" class="flower-petal" /><circle r="1.4" class="flower-center" /></g>
        <g class="flower" transform="translate(165,396)"><circle r="3" class="flower-petal" /><circle cx="4" cy="-1" r="3" class="flower-petal" /><circle cx="-1" cy="-4" r="3" class="flower-petal" /><circle r="1.4" class="flower-center" /></g>
        <g class="chicken" transform="translate(196,378)">
          <ellipse cx="0" cy="-6" rx="9" ry="7" class="chicken-body" />
          <circle cx="8" cy="-14" r="4" class="chicken-head" />
          <polygon points="12,-14 17,-13 12,-11" class="chicken-beak" />
          <path d="M-2 -18 q3 -3 6 0" class="chicken-comb" />
          <line x1="-3" y1="0" x2="-3" y2="4" class="chicken-leg" />
          <line x1="3" y1="0" x2="3" y2="4" class="chicken-leg" />
        </g>
        <g class="cart" transform="translate(120,382)">
          <rect x="-16" y="-16" width="26" height="12" class="cart-bed" />
          <line x1="10" y1="-10" x2="20" y2="-2" class="cart-handle" />
          <circle cx="-6" cy="0" r="7" class="cart-wheel" />
        </g>
      </g>

      <g class="well" transform="translate(${WELL_X}, 380)">
        <ellipse cx="0" cy="4" rx="38" ry="11" class="well-shadow" />
        <ellipse cx="0" cy="0" rx="34" ry="10" class="well-rim-base" />
        <rect x="-30" y="-38" width="60" height="38" class="well-stones" />
        <ellipse cx="0" cy="-38" rx="28" ry="8" class="well-mouth" />
        <ellipse cx="0" cy="-36" rx="20" ry="5" class="well-water" />

        <!-- Potence + toit en bois : élément identifiable "puits de
             campagne", jamais superposé au fermier (le fermier reste
             devant, en x=WELL_X mais au premier plan visuel). -->
        <rect x="-32" y="-88" width="6" height="48" class="well-post" />
        <rect x="26" y="-88" width="6" height="48" class="well-post" />
        <rect x="-36" y="-92" width="72" height="6" class="well-beam" />
        <polygon points="-40,-92 40,-92 0,-116" class="well-roof" />
        <polygon points="-40,-92 40,-92 0,-116" class="well-roof-shade" />
        <circle cx="0" cy="-86" r="4" class="well-pulley" />

        <g class="well-bucket-rig">
          <line x1="0" y1="-86" x2="0" y2="-52" class="well-rope" />
          <rect x="-7" y="-52" width="14" height="11" rx="2" class="well-bucket" />
        </g>
      </g>

      <g class="storage" transform="translate(${STORAGE_X}, 380)">
        <ellipse cx="0" cy="2" rx="34" ry="10" class="storage-shadow" />
        <path d="M-30 -94 Q-30 -104 0 -104 Q30 -104 30 -94 L30 -6 Q30 4 0 4 Q-30 4 -30 -6 Z" class="storage-barrel" />
        <path class="storage-fill" d="M0 0" clip-path="url(#storage-clip)" />
        <path d="M-30 -94 Q-30 -104 0 -104 Q30 -104 30 -94 L30 -6 Q30 4 0 4 Q-30 4 -30 -6 Z" class="storage-outline" fill="none" />
        <rect x="-31" y="-76" width="62" height="7" rx="2" class="storage-ring" />
        <rect x="-31" y="-38" width="62" height="7" rx="2" class="storage-ring" />
        <g class="storage-emblem" transform="translate(0,-48)">
          <path d="M0 -11 C6 -2 8 3 0 8 C-8 3 -6 -2 0 -11 Z" />
        </g>
      </g>

      <g class="truck" transform="translate(${TRUCK_HIDDEN_X}, 380)">
        <ellipse cx="0" cy="4" rx="50" ry="9" class="truck-shadow" />
        <rect x="-46" y="-44" width="70" height="30" rx="8" class="truck-tank" />
        <rect x="-46" y="-40" width="70" height="6" class="truck-tank-band" />
        <path d="M-46 -44 a35 22 0 0 1 0 30" class="truck-tank-cap" />
        <rect x="20" y="-30" width="26" height="24" rx="3" class="truck-cab" />
        <rect x="24" y="-27" width="12" height="10" rx="1" class="truck-window" />
        <rect x="-48" y="-16" width="98" height="6" class="truck-chassis" />
        <g class="truck-wheel-group" transform="translate(-26,-2)">
          <circle r="9" class="truck-wheel" />
          <circle r="9" class="truck-wheel-spin" />
        </g>
        <g class="truck-wheel-group" transform="translate(30,-2)">
          <circle r="9" class="truck-wheel" />
          <circle r="9" class="truck-wheel-spin" />
        </g>
      </g>

      <!-- Le fermier : un seul travailleur visible, un seul seau
           personnel (Seau B) qui l'accompagne en permanence. -->
      <g class="farmer" transform="translate(${HOME_X}, 380)">
        <g class="farmer-bob">
          <g class="farmer-hip" transform="translate(0, -20)">
            <g class="farmer-leg farmer-leg-l"><line x1="0" y1="0" x2="-7" y2="19" class="farmer-limb farmer-limb-leg" /></g>
            <g class="farmer-leg farmer-leg-r"><line x1="0" y1="0" x2="7" y2="19" class="farmer-limb farmer-limb-leg" /></g>
          </g>

          <path d="M-11 -44 Q-13 -16 -11 -8 L11 -8 Q13 -16 11 -44 Q0 -50 -11 -44 Z" class="farmer-body" />
          <rect x="-11" y="-30" width="22" height="4" class="farmer-strap" />

          <g class="farmer-shoulder" transform="translate(0, -40)">
            <g class="farmer-arm farmer-arm-l">
              <line x1="0" y1="0" x2="-10" y2="11" class="farmer-limb farmer-limb-arm" />
              <g class="farmer-hand-bucket" transform="translate(-10,11)">
                <line x1="0" y1="0" x2="0" y2="-5" class="farmer-bucket-handle" />
                <rect x="-6" y="-5" width="12" height="9" rx="1.5" class="farmer-bucket" />
              </g>
            </g>
            <g class="farmer-arm farmer-arm-r"><line x1="0" y1="0" x2="10" y2="11" class="farmer-limb farmer-limb-arm" /></g>
          </g>

          <circle cx="0" cy="-52" r="8.5" class="farmer-head" />
          <path d="M-6 -59 Q-6 -68 0 -68 Q6 -68 6 -59 Z" class="farmer-hat-top" />
          <ellipse cx="0" cy="-59" rx="11.5" ry="3" class="farmer-hat-brim" />
        </g>
      </g>

      <g class="waiting-indicator" transform="translate(${STORAGE_X}, 315)">
        <g class="waiting-indicator-bob">
          <circle r="10" class="waiting-bubble" />
          <text x="0" y="4" class="waiting-mark" text-anchor="middle">!</text>
        </g>
      </g>
    </svg>
  `;
}

const PHASE_TO_WORKER_X = {
  prepare: HOME_X,
  walkToWell: null, // interpolé
  lowerBucket: WELL_X,
  wellFill: WELL_X,
  raiseBucket: WELL_X,
  walkToStorage: null, // interpolé
  pour: STORAGE_X,
  walkBack: null, // interpolé
  // Le moteur bloque le fermier exactement au point de livraison quand le
  // stockage est plein : la position affichée doit rester STORAGE_X,
  // jamais un autre point (sinon retour à la téléportation déjà corrigée).
  waitingForRoom: STORAGE_X,
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function workerX(phase) {
  const known = PHASE_TO_WORKER_X[phase.key];
  if (known !== null && known !== undefined) return known;
  if (phase.key === "walkToWell") return lerp(HOME_X, WELL_X, phase.progress);
  if (phase.key === "walkToStorage") return lerp(WELL_X, STORAGE_X, phase.progress);
  if (phase.key === "walkBack") return lerp(STORAGE_X, HOME_X, phase.progress);
  return HOME_X;
}

// Seau A (puits) : descend/remonte DANS le puits, jamais ailleurs. Reste
// entièrement dans le repère local du groupe .well (jamais déplacé en x).
function wellBucketOffsetY(phase) {
  if (phase.key === "lowerBucket") return lerp(0, 34, phase.progress);
  if (phase.key === "wellFill") return 34;
  if (phase.key === "raiseBucket") return lerp(34, 0, phase.progress);
  return 0;
}

// Seau B (fermier) : ne bouge jamais indépendamment du corps — seul son
// état plein/vide change, exactement au moment où l'eau change réellement
// de contenant (fin du remplissage -> déversement à la réserve).
function isCarryingWater(phase) {
  return ["raiseBucket", "walkToStorage", "waitingForRoom"].includes(phase.key) || phase.key === "pour";
}

export function updateSceneAnimation(root, { phase, bufferRatio, truckRatio, isShipping, walking }) {
  const farmer = root.querySelector(".farmer");
  const farmerBucket = root.querySelector(".farmer-hand-bucket .farmer-bucket");
  const wellBucketRig = root.querySelector(".well-bucket-rig");
  const waitingIndicator = root.querySelector(".waiting-indicator");
  const storageFill = root.querySelector(".storage-fill");
  const truck = root.querySelector(".truck");

  const x = workerX(phase);
  farmer.setAttribute("transform", `translate(${x}, 380)`);
  wellBucketRig.setAttribute("transform", `translate(0, ${wellBucketOffsetY(phase)})`);
  farmerBucket.classList.toggle("farmer-bucket-full", isCarryingWater(phase));

  waitingIndicator.classList.toggle("is-visible", phase.paused);
  farmer.classList.toggle("is-walking", Boolean(walking));
  farmer.classList.toggle("is-waiting", Boolean(phase.paused));
  farmer.classList.toggle("is-working", phase.key === "lowerBucket" || phase.key === "wellFill" || phase.key === "raiseBucket" || phase.key === "pour");

  const fillRatio = Math.max(0, Math.min(1, bufferRatio));
  const barrelHeight = 98;
  const barrelBottom = 4;
  const fillHeight = fillRatio * barrelHeight;
  const top = -6 - fillHeight;
  storageFill.setAttribute(
    "d",
    `M-30 ${barrelBottom} L-30 ${top} Q-30 ${top - 6} 0 ${top - 6} Q30 ${top - 6} 30 ${top} L30 ${barrelBottom} Q30 ${barrelBottom + 8} 0 ${barrelBottom + 8} Q-30 ${barrelBottom + 8} -30 ${barrelBottom} Z`
  );

  // V4 (section 4/5 du cahier des charges) : "le camion doit accélérer/se
  // déplacer/repartir sans saut visuel". Le moteur économique fait
  // repartir `transport.timerMs` de zéro INSTANTANÉMENT au tick même où
  // le camion charge (voir tickTransport, mapEconomy.js) — un bug réel
  // fut trouvé ici : dériver la position du camion directement du ratio
  // brut faisait donc RECULER le camion à sa position cachée en un seul
  // instant, pile au moment le plus visible (juste après avoir chargé).
  // Corrigé en scriptant explicitement une phase de départ (temps réel,
  // indépendante du ratio économique) dès que l'expédition est détectée.
  const now = Date.now();
  if (isShipping === true) departStartAt = now;
  const departingNow = departStartAt !== null && now - departStartAt < TRUCK_DEPART_MS;

  let truckX;
  let arrivingNow = false;
  if (departingNow) {
    const t = (now - departStartAt) / TRUCK_DEPART_MS;
    truckX = lerp(TRUCK_DOCK_X, TRUCK_HIDDEN_X, t);
  } else {
    departStartAt = null;
    arrivingNow = truckRatio >= 0.7 && truckRatio < 0.98;
    truckX = truckRatio >= 0.7 ? lerp(TRUCK_HIDDEN_X, TRUCK_DOCK_X, Math.min(1, (truckRatio - 0.7) / 0.3)) : TRUCK_HIDDEN_X;
  }
  truck.setAttribute("transform", `translate(${truckX}, 380)`);
  truck.classList.toggle("is-docked", !departingNow && truckRatio >= 0.98);
  truck.classList.toggle("is-driving", departingNow || arrivingNow);
  // `isShipping` reste `undefined` lors des images de rendu interpolées
  // (requestAnimationFrame, entre deux ticks économiques) : la classe ne
  // doit alors jamais être touchée, sous peine de couper le flash
  // "truck-flash" (animation CSS ponctuelle) avant qu'il ait pu jouer.
  if (typeof isShipping === "boolean") truck.classList.toggle("is-shipping", isShipping);
}
