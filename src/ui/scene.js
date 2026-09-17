// Rendu de la scène unique : un seul SVG statique dont les calques se
// révèlent progressivement (jamais d'échange brutal d'image). Chaque
// calque correspond à un palier de `STAGES` — l'accumulation visuelle
// EST la transformation, pas un compteur.

const LAYER_REVEAL = {
  water: 1,
  moss: 2,
  sprouts: 3,
  bushes: 4,
  fauna: 5,
  glow: 6,
};

// Couleurs de fond (ciel / sol) par palier : une terre stérile devient
// progressivement un ciel et un sol vivants.
const STAGE_PALETTE = [
  { sky: "#1a2321", ground: "#5c4d3c" }, // 0 terre stérile
  { sky: "#1c2c28", ground: "#5f5340" }, // 1 premier filet d'eau
  { sky: "#1d3730", ground: "#4f5738" }, // 2 mousse et humus
  { sky: "#1c3d33", ground: "#3f5c36" }, // 3 premières pousses
  { sky: "#1a4238", ground: "#315a30" }, // 4 broussailles
  { sky: "#173f3c", ground: "#2b5a34" }, // 5 retour de la faune
  { sky: "#123634", ground: "#245c3a" }, // 6 havre vivant
];

export function sceneMarkup() {
  return `
    <svg class="haven-scene" viewBox="0 0 400 520" role="img" aria-label="Le petit monde de HAVEN" preserveAspectRatio="xMidYMax slice">
      <defs>
        <radialGradient id="glowGrad" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#bfe6cf" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#bfe6cf" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect class="layer-sky" x="0" y="0" width="400" height="520" />

      <g class="layer-ground-group">
        <path class="layer-ground" d="M0 340 C 80 300, 140 320, 210 305 C 280 292, 330 315, 400 300 L 400 520 L 0 520 Z" />
      </g>

      <g class="layer water" data-layer="water">
        <ellipse cx="200" cy="330" rx="46" ry="16" fill="#2d6f7a" />
        <ellipse class="ripple ripple-1" cx="200" cy="330" rx="46" ry="16" />
        <ellipse class="ripple ripple-2" cx="200" cy="330" rx="46" ry="16" />
        <path class="rivulet" d="M200 330 C 195 360, 205 390, 198 420 C 193 445, 202 470, 197 495" />
      </g>

      <g class="layer moss" data-layer="moss">
        <ellipse cx="110" cy="360" rx="38" ry="10" />
        <ellipse cx="300" cy="345" rx="44" ry="11" />
        <ellipse cx="170" cy="400" rx="30" ry="8" />
        <ellipse cx="260" cy="420" rx="36" ry="9" />
      </g>

      <g class="layer sprouts" data-layer="sprouts">
        <path class="sway" d="M130 358 q-4 -18 -1 -28" />
        <path class="sway sway-b" d="M270 340 q5 -20 1 -30" />
        <path class="sway" d="M150 405 q-3 -14 0 -22" />
        <path class="sway sway-b" d="M240 428 q4 -16 0 -24" />
      </g>

      <g class="layer bushes" data-layer="bushes">
        <g class="sway-slow">
          <circle cx="85" cy="345" r="16" />
          <circle cx="100" cy="335" r="12" />
        </g>
        <g class="sway-slow sway-b">
          <circle cx="320" cy="330" r="18" />
          <circle cx="336" cy="342" r="13" />
        </g>
        <g class="sway-slow">
          <circle cx="230" cy="400" r="14" />
          <circle cx="215" cy="410" r="10" />
        </g>
      </g>

      <g class="layer fauna" data-layer="fauna">
        <g class="bob">
          <ellipse cx="150" cy="330" rx="7" ry="5" fill="#e7d9b8" />
          <path d="M150 325 l6 -6" stroke="#e7d9b8" stroke-width="2" fill="none" />
        </g>
        <g class="bob bob-b">
          <path d="M280 300 q8 -6 16 0 q-8 4 -16 0 Z" fill="#e7d9b8" />
        </g>
      </g>

      <g class="layer glow" data-layer="glow">
        <rect x="0" y="0" width="400" height="520" fill="url(#glowGrad)" />
        <circle class="firefly firefly-1" cx="130" cy="300" r="2.4" />
        <circle class="firefly firefly-2" cx="260" cy="280" r="2" />
        <circle class="firefly firefly-3" cx="200" cy="250" r="2.2" />
        <circle class="firefly firefly-4" cx="310" cy="310" r="1.8" />
      </g>
    </svg>
  `;
}

export function applyStageVisuals(root, stageId) {
  root.dataset.stage = String(stageId);
  const palette = STAGE_PALETTE[Math.min(stageId, STAGE_PALETTE.length - 1)];
  root.style.setProperty("--sky-color", palette.sky);
  root.style.setProperty("--ground-color", palette.ground);

  root.querySelectorAll("[data-layer]").forEach((el) => {
    const reveal = LAYER_REVEAL[el.dataset.layer] ?? 0;
    el.classList.toggle("is-revealed", stageId >= reveal);
  });
}
