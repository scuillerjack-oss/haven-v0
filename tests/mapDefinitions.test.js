// Régression V2 : la bêta Android a montré des jambes détachées à cause
// d'animations trop rapides / mal ancrées. Le vrai correctif est visuel
// (scene.js/style.css, non testable par node:test), mais le moteur DOIT
// garantir qu'aucun niveau d'amélioration, à aucun palier, ne produit une
// durée de phase ou un intervalle de transport en dessous du plancher
// visuel — sinon l'animation redevient illisible quel que soit le rendu.
// Un bug exact de ce type (arrondi "au plus proche" au lieu de "vers le
// haut" sur le plancher du puits) a été trouvé par ce test avant d'être
// corrigé dans mapDefinitions.js (ceil2 au lieu de round2).
import test from "node:test";
import assert from "node:assert/strict";
import { WATER_MAP, MIN_VISUAL_PHASE_MS, MIN_VISUAL_TRANSPORT_INTERVAL_MS } from "../src/engine/mapDefinitions.js";

test("aucune phase animée, à aucun niveau d'aucune famille, ne descend sous MIN_VISUAL_PHASE_MS", () => {
  for (const [pathId, family] of Object.entries(WATER_MAP.producerUpgrades)) {
    for (const level of family.levels) {
      if (level.multiplier === undefined) continue; // familles non temporelles (ex. seau)
      for (const [phaseKey, famId] of Object.entries(WATER_MAP.phaseFamily)) {
        if (famId !== pathId) continue;
        const durationMs = WATER_MAP.phases[phaseKey] * level.multiplier;
        assert.ok(
          durationMs >= MIN_VISUAL_PHASE_MS,
          `${pathId} niveau ${level.level} rend ${phaseKey} à ${durationMs}ms, sous le plancher ${MIN_VISUAL_PHASE_MS}ms`
        );
      }
    }
  }
});

test("aucun niveau de fréquence de transport ne descend sous MIN_VISUAL_TRANSPORT_INTERVAL_MS", () => {
  for (const level of WATER_MAP.transportFrequencyUpgrades.levels) {
    assert.ok(
      level.intervalMs >= MIN_VISUAL_TRANSPORT_INTERVAL_MS,
      `niveau ${level.level} descend à ${level.intervalMs}ms, sous le plancher ${MIN_VISUAL_TRANSPORT_INTERVAL_MS}ms`
    );
  }
});

test("le dernier niveau de chaque famille plafonnée atteint le plancher visuel sans jamais le dépasser vers le bas (l'axe est vraiment épuisé, pas juste proche)", () => {
  for (const [pathId, family] of Object.entries(WATER_MAP.producerUpgrades)) {
    const last = family.levels.at(-1);
    if (last.multiplier === undefined) continue;
    const affectedPhases = Object.entries(WATER_MAP.phaseFamily).filter(([, famId]) => famId === pathId);
    const shortestPhaseMs = Math.min(...affectedPhases.map(([phaseKey]) => WATER_MAP.phases[phaseKey]));
    const durationAtLastLevel = shortestPhaseMs * last.multiplier;
    assert.ok(durationAtLastLevel >= MIN_VISUAL_PHASE_MS, `${pathId} : dernier niveau encore sous le plancher`);
    assert.ok(
      durationAtLastLevel < MIN_VISUAL_PHASE_MS + shortestPhaseMs * 0.05,
      `${pathId} : le dernier niveau devrait être proche du plancher (axe épuisé), pas laisser de marge inutilisée`
    );
  }
});

test("les coûts sont strictement croissants et le niveau 1 est toujours gratuit (départ immédiat)", () => {
  const allFamilies = [
    ...Object.values(WATER_MAP.producerUpgrades),
    WATER_MAP.bufferUpgrades,
    WATER_MAP.transportCapacityUpgrades,
    WATER_MAP.transportFrequencyUpgrades,
    WATER_MAP.globalProductivityUpgrades,
  ];
  for (const family of allFamilies) {
    assert.equal(family.levels[0].cost, 0, `${family.name} : le niveau 1 doit être gratuit`);
    for (let i = 1; i < family.levels.length; i += 1) {
      assert.ok(
        family.levels[i].cost > family.levels[i - 1].cost,
        `${family.name} : le coût doit strictement augmenter à chaque niveau`
      );
    }
  }
});
