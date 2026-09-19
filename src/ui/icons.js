// Pictogrammes V4 (cahier des charges V4, section 10) : la direction des
// petits dessins illustrés à côté des cartes d'amélioration est validée
// (référence visuelle) — miniatures colorées et immédiatement
// reconnaissables, pas de simples contours monochromes. Toujours du SVG
// inline (quelques octets, aucune image rastérisée, cohérent avec le
// reste de la scène).

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
  // Seau : mêmes couleurs que celui porté par le fermier dans la scène.
  bucket: `<path d="M5 7 L15 7 L13.2 17 L6.8 17 Z" class="icon-bucket-body" />
           <path d="M6 7 L14 7 L13.3 10 L6.7 10 Z" class="icon-bucket-water" />
           <path d="M6 7 Q10 3 14 7" class="icon-bucket-handle" />`,
  // Déplacement : silhouette d'une foulée, cohérente avec le fermier.
  movement: `<circle cx="10" cy="4.6" r="2.1" class="icon-farmer-skin" />
             <path d="M10 6.8 L10 11.5" class="icon-farmer-body-line" />
             <path d="M10 8.4 L6 7.4 M10 8.4 L14.4 6.6" class="icon-farmer-limb" />
             <path d="M10 11.5 L6.2 18 M10 11.5 L13.6 17" class="icon-farmer-limb" />`,
  // Corde / treuil : poulie en bois avec corde.
  winch: `<circle cx="10" cy="9.5" r="6" class="icon-winch-wheel" />
          <circle cx="10" cy="9.5" r="6" class="icon-winch-rim" />
          <circle cx="10" cy="9.5" r="1.8" class="icon-winch-axle" />
          <path d="M10 15.5 L10 18.5" class="icon-winch-rope" />`,
  // Puits : version miniature du puits de la scène (mêmes couleurs).
  well: `<rect x="4.5" y="11" width="11" height="6" class="icon-well-stones" />
         <ellipse cx="10" cy="11" rx="5.5" ry="1.8" class="icon-well-mouth" />
         <path d="M3 11 L17 11" class="icon-well-beam" />
         <polygon points="2.5,11 17.5,11 10,4" class="icon-well-roof" />`,
  // Réserve : mini tonneau, mêmes couleurs que la grande réserve.
  buffer: `<path d="M6 4.5 Q10 2.5 14 4.5 L14 15.5 Q10 17.5 6 15.5 Z" class="icon-barrel-body" />
           <rect x="6" y="8.6" width="8" height="1.6" class="icon-barrel-ring" />
           <path d="M10 11.5 c1.6 2 2 3.4 0 5 c-2 -1.6 -1.6 -3 0 -5 Z" class="icon-barrel-drop" />`,
  // Citerne : mini camion-citerne (citerne argentée + cabine bleue).
  transportCapacity: `<rect x="2" y="8" width="11" height="6" rx="2.4" class="icon-truck-tank" />
                      <rect x="13" y="9.5" width="4.5" height="4.5" rx="0.8" class="icon-truck-cab" />
                      <circle cx="5.5" cy="15" r="1.7" class="icon-truck-wheel" />
                      <circle cx="14.5" cy="15" r="1.7" class="icon-truck-wheel" />`,
  // Fréquence transport : horloge.
  transportFrequency: `<circle cx="10" cy="10" r="7.4" class="icon-clock-face" />
                       <circle cx="10" cy="10" r="7.4" class="icon-clock-rim" />
                       <path d="M10 5.6 L10 10 L13.2 12.2" class="icon-clock-hands" />`,
  globalProductivity: null, // pièce, voir coinIcon()
};

export function familyIconMarkup(pathId) {
  if (pathId === "globalProductivity") return coinIcon();
  const inner = FAMILY_ICONS[pathId];
  return inner ? icon(inner) : "";
}
