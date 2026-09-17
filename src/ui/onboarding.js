// Onboarding contextuel très court (3 indices maximum), chacun disparaît
// dès que l'action correspondante est faite — jamais un tutoriel qui bloque.
export const ONBOARDING_MESSAGES = [
  "Touchez la source pour puiser de l'eau.",
  "Le monde avance aussi tout seul : regardez la vitalité monter.",
  "De nouveaux choix sont apparus — ouvrez le tiroir en bas.",
];

export function renderOnboarding(root, step) {
  if (step >= ONBOARDING_MESSAGES.length) {
    root.hidden = true;
    root.textContent = "";
    return;
  }
  root.hidden = false;
  root.textContent = ONBOARDING_MESSAGES[step];
}
