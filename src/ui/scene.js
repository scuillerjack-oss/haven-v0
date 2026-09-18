// Scène de la Map 1 : un seul SVG statique, un travailleur animé qui
// parcourt un cycle physique complet (jamais de téléportation d'un poste
// à l'autre), un stockage dont le niveau se voit, un camion qui arrive et
// repart. L'inefficacité (stockage plein) devient une animation, pas un
// blocage.

const HOME_X = 150;
const WELL_X = 70;
const STORAGE_X = 230;
const TRUCK_DOCK_X = 300;
const TRUCK_HIDDEN_X = 420;

export function sceneMarkup() {
  return `
    <svg class="haven-scene" viewBox="0 0 400 520" role="img" aria-label="La chaîne de l'eau" preserveAspectRatio="xMidYMax slice">
      <rect class="scene-sky" x="0" y="0" width="400" height="520" />

      <!-- Direction visuelle V3 (cahier des charges post-bêta, section 6) :
           un petit lieu de campagne cohérent plutôt qu'un espace vide.
           Purement décoratif, statique (aucune animation, aucun élément
           interactif) : jamais repositionné, jamais superposé aux éléments
           fonctionnels (puits/stockage/camion/travailleur), qui restent
           seuls à bouger. Formes plates simples (SVG inline) pour rester
           légères et cohérentes avec le style existant, jamais une image
           rastérisée. -->
      <!-- Zone garantie libre de tout élément fonctionnel, quel que soit x :
           le plus haut d'entre eux (le sommet de la citerne de stockage)
           s'arrête à y=260. Tout le décor tient donc au-dessus de cette
           ligne (y <= 250), et entre x=85 et x=315 pour rester visible
           même sur la largeur la plus étroite testée (320px, la plus
           défavorable au recadrage horizontal du "slice" — voir
           scripts/check-mobile-resume.mjs) — vérifié par mesure réelle
           des rectangles rendus (getBoundingClientRect), pas supposé. -->
      <g class="scenery" aria-hidden="true">
        <path class="hill hill-back" d="M0 260 Q100 165 220 205 T400 185 L400 380 L0 380 Z" />
        <path class="hill hill-front" d="M0 300 Q140 225 260 255 T400 240 L400 380 L0 380 Z" />

        <g class="cabin" transform="translate(280, 240)">
          <rect x="-15" y="-20" width="30" height="20" class="cabin-wall" />
          <polygon points="-18,-20 18,-20 0,-33" class="cabin-roof" />
          <rect x="-5" y="-11" width="9" height="11" class="cabin-door" />
          <rect x="-11" y="-15" width="6" height="6" class="cabin-window" />
          <rect x="3" y="-30" width="4" height="9" class="cabin-chimney" />
        </g>

        <g class="tree" transform="translate(120, 250)">
          <rect x="-3" y="-26" width="6" height="26" class="tree-trunk" />
          <circle cx="0" cy="-34" r="17" class="tree-canopy" />
          <circle cx="-11" cy="-26" r="12" class="tree-canopy" />
          <circle cx="11" cy="-28" r="13" class="tree-canopy" />
        </g>
        <g class="tree tree-small" transform="translate(305, 235)">
          <rect x="-2.5" y="-20" width="5" height="20" class="tree-trunk" />
          <circle cx="0" cy="-26" r="13" class="tree-canopy" />
          <circle cx="-8" cy="-20" r="9" class="tree-canopy" />
        </g>
      </g>

      <path class="scene-ground" d="M0 380 L400 380 L400 520 L0 520 Z" />
      <path class="scene-path" d="M20 380 Q150 372 400 378 L400 384 Q150 378 20 384 Z" />

      <g class="well" transform="translate(${WELL_X}, 380)">
        <ellipse cx="0" cy="0" rx="34" ry="10" class="well-rim" />
        <rect x="-30" y="-46" width="60" height="46" class="well-body" />
        <ellipse cx="0" cy="-46" rx="30" ry="8" class="well-mouth" />
      </g>

      <g class="storage" transform="translate(${STORAGE_X}, 380)">
        <rect x="-38" y="-120" width="76" height="120" class="storage-tank-outline" />
        <clipPath id="storage-clip">
          <rect x="-36" y="-118" width="72" height="116" />
        </clipPath>
        <rect class="storage-fill" x="-36" y="-2" width="72" height="0" clip-path="url(#storage-clip)" />
        <rect x="-38" y="-120" width="76" height="120" class="storage-tank-frame" fill="none" />
      </g>

      <g class="truck" transform="translate(${TRUCK_HIDDEN_X}, 380)">
        <rect x="-46" y="-40" width="92" height="34" class="truck-tank" />
        <rect x="30" y="-26" width="20" height="20" class="truck-cab" />
        <circle cx="-28" cy="-2" r="8" class="truck-wheel" />
        <circle cx="24" cy="-2" r="8" class="truck-wheel" />
      </g>

      <g class="worker" transform="translate(${HOME_X}, 380)">
        <g class="worker-bucket-arm">
          <line x1="0" y1="-30" x2="0" y2="-46" class="worker-rope" />
          <rect x="-8" y="-46" width="16" height="12" rx="2" class="worker-bucket" />
        </g>
        <circle cx="0" cy="-52" r="8" class="worker-head" />
        <line x1="0" y1="-44" x2="0" y2="-20" class="worker-torso" />

        <!-- Hanche et épaule portent SEULES le placement statique (attribut
             transform) ; les groupes enfants ne reçoivent que la rotation
             CSS, avec un transform-origin explicite à leur propre (0,0) —
             qui coïncide donc exactement avec l'articulation. Mélanger un
             attribut transform et une transform CSS sur LE MÊME élément
             fait que CSS écrase l'attribut (au lieu de les combiner) ; les
             jambes semblaient "détachées" du corps précisément parce que la
             rotation pivotait sur le centre de la boîte englobante de la
             ligne plutôt que sur la hanche. -->
        <g class="worker-shoulder" transform="translate(0, -38)">
          <g class="worker-arm worker-arm-l"><line x1="0" y1="0" x2="-9" y2="10" class="worker-limb" /></g>
          <g class="worker-arm worker-arm-r"><line x1="0" y1="0" x2="9" y2="10" class="worker-limb" /></g>
        </g>
        <g class="worker-hip" transform="translate(0, -20)">
          <g class="worker-leg worker-leg-l"><line x1="0" y1="0" x2="-7" y2="20" class="worker-limb" /></g>
          <g class="worker-leg worker-leg-r"><line x1="0" y1="0" x2="7" y2="20" class="worker-limb" /></g>
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
  // Le nouveau moteur (V2) bloque le travailleur exactement au point de
  // livraison quand le stockage est plein : la position affichée doit
  // rester STORAGE_X, jamais un autre point (sinon on retombe dans la
  // téléportation que ce correctif corrige).
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

function bucketOffsetY(phase) {
  // Descend au puits, remonte, reste en haut ailleurs. Jamais de saut brutal.
  if (phase.key === "lowerBucket") return lerp(0, 34, phase.progress);
  if (phase.key === "wellFill") return 34;
  if (phase.key === "raiseBucket") return lerp(34, 0, phase.progress);
  return 0;
}

function isCarryingWater(phase) {
  return ["raiseBucket", "walkToStorage", "waitingForRoom"].includes(phase.key) || phase.key === "pour";
}

export function updateSceneAnimation(root, { phase, bufferRatio, truckRatio, isShipping, walking }) {
  const worker = root.querySelector(".worker");
  const bucketArm = root.querySelector(".worker-bucket-arm");
  const bucket = root.querySelector(".worker-bucket");
  const waitingIndicator = root.querySelector(".waiting-indicator");
  const storageFill = root.querySelector(".storage-fill");
  const truck = root.querySelector(".truck");

  const x = workerX(phase);
  worker.setAttribute("transform", `translate(${x}, 380)`);
  bucketArm.setAttribute("transform", `translate(0, ${bucketOffsetY(phase)})`);
  bucket.classList.toggle("worker-bucket-full", isCarryingWater(phase));

  waitingIndicator.classList.toggle("is-visible", phase.paused);
  // Une seule source de vérité pour marche/attente : les classes CSS
  // conditionnent entièrement quelles animations tournent (voir style.css),
  // pas de bascule manuelle d'animation-play-state redondante ici.
  worker.classList.toggle("is-walking", Boolean(walking));
  worker.classList.toggle("is-waiting", Boolean(phase.paused));

  const fillHeight = Math.max(0, Math.min(1, bufferRatio)) * 116;
  storageFill.setAttribute("height", String(fillHeight));
  storageFill.setAttribute("y", String(-2 - fillHeight));

  const truckX = truckRatio >= 0.7 ? lerp(TRUCK_HIDDEN_X, TRUCK_DOCK_X, Math.min(1, (truckRatio - 0.7) / 0.3)) : TRUCK_HIDDEN_X;
  truck.setAttribute("transform", `translate(${truckX}, 380)`);
  truck.classList.toggle("is-docked", truckRatio >= 0.98);
  // `isShipping` reste `undefined` lors des images de rendu interpolées
  // (requestAnimationFrame, entre deux ticks économiques) : la classe ne
  // doit alors jamais être touchée, sous peine de couper le flash
  // "truck-flash" (animation CSS ponctuelle) avant qu'il ait pu jouer.
  if (typeof isShipping === "boolean") truck.classList.toggle("is-shipping", isShipping);
}
