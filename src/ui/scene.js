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
      <path class="scene-ground" d="M0 380 L400 380 L400 520 L0 520 Z" />

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
        <line x1="0" y1="-44" x2="0" y2="-20" class="worker-body" />
        <line x1="0" y1="-38" x2="-9" y2="-28" class="worker-arm worker-arm-l" />
        <line x1="0" y1="-38" x2="9" y2="-28" class="worker-arm worker-arm-r" />
        <line x1="0" y1="-20" x2="-7" y2="0" class="worker-leg worker-leg-l" />
        <line x1="0" y1="-20" x2="7" y2="0" class="worker-leg worker-leg-r" />
      </g>

      <g class="waiting-indicator" transform="translate(${STORAGE_X - 20}, 320)">
        <circle r="10" class="waiting-bubble" />
        <text x="0" y="4" class="waiting-mark" text-anchor="middle">!</text>
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
  waitingForRoom: STORAGE_X - 20,
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
  const legL = root.querySelector(".worker-leg-l");
  const legR = root.querySelector(".worker-leg-r");
  const waitingIndicator = root.querySelector(".waiting-indicator");
  const storageFill = root.querySelector(".storage-fill");
  const truck = root.querySelector(".truck");

  const x = workerX(phase);
  worker.setAttribute("transform", `translate(${x}, 380)`);
  bucketArm.setAttribute("transform", `translate(0, ${bucketOffsetY(phase)})`);
  bucket.classList.toggle("worker-bucket-full", isCarryingWater(phase));

  waitingIndicator.classList.toggle("is-visible", phase.paused);
  worker.classList.toggle("is-walking", Boolean(walking));
  legL.style.animationPlayState = walking ? "running" : "paused";
  legR.style.animationPlayState = walking ? "running" : "paused";

  const fillHeight = Math.max(0, Math.min(1, bufferRatio)) * 116;
  storageFill.setAttribute("height", String(fillHeight));
  storageFill.setAttribute("y", String(-2 - fillHeight));

  const truckX = truckRatio >= 0.7 ? lerp(TRUCK_HIDDEN_X, TRUCK_DOCK_X, Math.min(1, (truckRatio - 0.7) / 0.3)) : TRUCK_HIDDEN_X;
  truck.setAttribute("transform", `translate(${truckX}, 380)`);
  truck.classList.toggle("is-docked", truckRatio >= 0.98);
  truck.classList.toggle("is-shipping", Boolean(isShipping));
}
