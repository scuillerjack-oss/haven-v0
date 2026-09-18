// Pictogrammes V3 (cahier des charges post-bêta, section 6) : une forme
// géométrique simple par famille et une pièce à côté de l'argent — jamais
// une image rastérisée (SVG inline, quelques octets, aucune requête
// réseau, cohérent avec le style déjà minimaliste du reste de la scène).

function icon(inner, extraClass = "") {
  return `<svg class="family-icon ${extraClass}" viewBox="0 0 20 20" aria-hidden="true">${inner}</svg>`;
}

export function coinIcon() {
  return icon(
    `<circle cx="8" cy="11" r="6" class="icon-coin-back" />
     <circle cx="12" cy="9" r="6" class="icon-coin-front" />
     <circle cx="12" cy="9" r="6" class="icon-coin-ring" />`,
    "icon-coin"
  );
}

const FAMILY_ICONS = {
  bucket: `<path d="M5 6 L15 6 L13 16 L7 16 Z" class="icon-shape" />
           <path d="M6 6 Q10 2 14 6" class="icon-line" />`,
  movement: `<circle cx="10" cy="4.5" r="2.3" class="icon-shape" />
             <path d="M10 7 L10 12 M10 9 L5 8 M10 9 L15 7 M10 12 L6 18 M10 12 L14 17" class="icon-line" />`,
  winch: `<circle cx="10" cy="10" r="6" class="icon-line" fill="none" />
          <path d="M10 4 A6 6 0 0 1 16 10" class="icon-line-bold" fill="none" />
          <circle cx="10" cy="10" r="1.6" class="icon-shape" />`,
  well: `<path d="M4 17 L4 9 Q10 4 16 9 L16 17" class="icon-line" fill="none" />
         <path d="M3 9 L17 9" class="icon-line-bold" />
         <path d="M10 9 L10 15" class="icon-line" />`,
  buffer: `<path d="M6 5 L14 5 L14 17 Q10 19 6 17 Z" class="icon-shape" />
           <ellipse cx="10" cy="5" rx="4" ry="1.6" class="icon-shape-top" />`,
  transportCapacity: `<rect x="2" y="7" width="12" height="7" rx="2" class="icon-shape" />
                      <rect x="14" y="9" width="4" height="5" class="icon-shape-top" />
                      <circle cx="6" cy="15.5" r="1.6" class="icon-line-bold" />
                      <circle cx="15" cy="15.5" r="1.6" class="icon-line-bold" />`,
  transportFrequency: `<circle cx="10" cy="10" r="7" class="icon-line" fill="none" />
                       <path d="M10 6 L10 10 L13 12" class="icon-line-bold" fill="none" />`,
  globalProductivity: null, // pièce, voir coinIcon()
};

export function familyIconMarkup(pathId) {
  if (pathId === "globalProductivity") return coinIcon();
  const inner = FAMILY_ICONS[pathId];
  return inner ? icon(inner) : "";
}
