// Moteur économique pur d'une map : production → stockage → transport.
// Aucune dépendance au DOM ni à Date.now() implicite — tout est passé en
// paramètre pour rester testable et rejouable en simulation déterministe.
//
// `modifiers` (optionnel, neutre par défaut) porte les bonus de méta-
// progression (atouts permanents + bonus de prestige) : ils s'appliquent
// uniformément à toute map, présente ou future, jamais à un objet précis
// d'une chaîne (section 15).

const NEUTRAL_MODIFIERS = Object.freeze({
  productionMultiplier: 1,
  cycleSpeedMultiplier: 1,
  storageMultiplier: 1,
  logisticsMultiplier: 1,
});

function phaseMultiplier(familyDef, level) {
  const entry = familyDef.levels.find((l) => l.level === level);
  return entry ? entry.multiplier : 1;
}

// Exposé pour l'UI (animation du travailleur) autant que pour le moteur :
// une seule source de vérité pour la durée de chaque phase du cycle.
export function producerPhaseDurations(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS) {
  const { phases, phaseFamily, producerUpgrades } = mapDef;
  const speed = modifiers.cycleSpeedMultiplier ?? 1;
  return Object.entries(phases).map(([phaseKey, baseMs]) => {
    const family = phaseFamily[phaseKey];
    const mult = family ? phaseMultiplier(producerUpgrades[family], mapState.producer[`${family}Level`]) : 1;
    return { key: phaseKey, durationMs: baseMs * mult * speed };
  });
}

export function producerCycleMs(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS) {
  return producerPhaseDurations(mapState, mapDef, modifiers).reduce((sum, p) => sum + p.durationMs, 0);
}

export function producerBucketLiters(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS) {
  const level = mapState.producer.bucketLevel;
  const entry = mapDef.producerUpgrades.bucket.levels.find((l) => l.level === level);
  const base = entry ? entry.liters : 1;
  return base * (modifiers.productionMultiplier ?? 1);
}

export function producerRatePerMs(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS) {
  return producerBucketLiters(mapState, mapDef, modifiers) / producerCycleMs(mapState, mapDef, modifiers);
}

// Le trajet se coupe en deux étapes : "outbound" (prepare -> ... ->
// walkToStorage, jusqu'au point de livraison inclus) et "return" (pour +
// walkBack). La livraison est tentée exactement à la frontière entre les
// deux — jamais après un retour déjà animé comme si elle avait réussi.
const STAGE_BOUNDARY_KEY = "pour";

function stagePhaseKeys(mapDef, stage) {
  const keys = Object.keys(mapDef.phases);
  const idx = keys.indexOf(STAGE_BOUNDARY_KEY);
  return stage === "outbound" ? keys.slice(0, idx) : keys.slice(idx);
}

export function stageDurations(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS, stage = "outbound") {
  const keys = new Set(stagePhaseKeys(mapDef, stage));
  return producerPhaseDurations(mapState, mapDef, modifiers).filter((p) => keys.has(p.key));
}

export function stageTotalMs(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS, stage = "outbound") {
  return stageDurations(mapState, mapDef, modifiers, stage).reduce((sum, p) => sum + p.durationMs, 0);
}

export function bufferCapacity(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS) {
  const entry = mapDef.bufferUpgrades.levels.find((l) => l.level === mapState.buffer.level);
  const base = entry ? entry.capacity : 50;
  return base * (modifiers.storageMultiplier ?? 1);
}

export function transportCapacity(mapState, mapDef) {
  const entry = mapDef.transportCapacityUpgrades.levels.find((l) => l.level === mapState.transport.capacityLevel);
  return entry ? entry.capacity : 50;
}

export function transportIntervalMs(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS) {
  const entry = mapDef.transportFrequencyUpgrades.levels.find((l) => l.level === mapState.transport.frequencyLevel);
  const base = entry ? entry.intervalMs : 60_000;
  return base * (modifiers.logisticsMultiplier ?? 1);
}

export function globalProductivityMultiplier(mapState, mapDef) {
  const entry = mapDef.globalProductivityUpgrades.levels.find((l) => l.level === mapState.globalProductivityLevel);
  return entry ? entry.multiplier : 1;
}

export function transportThroughputPerMs(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS) {
  return transportCapacity(mapState, mapDef) / transportIntervalMs(mapState, mapDef, modifiers);
}

// Fait avancer le travailleur de deltaMs à travers son cycle en deux
// étapes. La livraison (dépôt dans le stockage) est tentée exactement à la
// fin de l'étape "outbound" — au moment où le personnage arrive au
// stockage, seau plein. Si la place manque, il reste bloqué PILE à cet
// endroit (awaitingRoom) au lieu de continuer une animation de retour qui
// mentirait sur ce qui s'est réellement passé. L'inefficacité devient une
// animation à l'endroit exact où elle a lieu, jamais un blocage du jeu.
function tickProducer(mapState, mapDef, deltaMs, modifiers) {
  const producer = mapState.producer;
  const bucketLiters = producerBucketLiters(mapState, mapDef, modifiers);
  const capacity = bufferCapacity(mapState, mapDef, modifiers);
  let remaining = deltaMs;

  while (remaining > 0) {
    if (producer.awaitingRoom) {
      const room = capacity - mapState.buffer.currentLiters;
      if (room >= bucketLiters) {
        mapState.buffer.currentLiters += bucketLiters;
        producer.awaitingRoom = false;
        producer.stage = "return";
        producer.stageProgressMs = 0;
      } else {
        return; // toujours bloqué au point de livraison, rien de plus ce tick.
      }
    }

    const stageMs = stageTotalMs(mapState, mapDef, modifiers, producer.stage);
    if (stageMs <= 0) break; // garde-fou défensif, ne devrait jamais arriver en pratique.

    const step = Math.min(remaining, stageMs - producer.stageProgressMs);
    producer.stageProgressMs += step;
    remaining -= step;

    if (producer.stageProgressMs >= stageMs) {
      if (producer.stage === "outbound") {
        const room = capacity - mapState.buffer.currentLiters;
        if (room >= bucketLiters) {
          mapState.buffer.currentLiters += bucketLiters;
          producer.stage = "return";
          producer.stageProgressMs = 0;
        } else {
          producer.awaitingRoom = true;
          producer.stageProgressMs = stageMs; // reste pile au point de livraison.
          return;
        }
      } else {
        producer.stage = "outbound";
        producer.stageProgressMs = 0;
      }
    }
  }
}

function tickTransport(mapState, mapDef, deltaMs, modifiers) {
  const transport = mapState.transport;
  const intervalMs = transportIntervalMs(mapState, mapDef, modifiers);
  const capacity = transportCapacity(mapState, mapDef);
  const productivity = globalProductivityMultiplier(mapState, mapDef);

  transport.timerMs += deltaMs;
  let litersShipped = 0;
  let moneyEarned = 0;
  while (transport.timerMs >= intervalMs) {
    const amount = Math.min(capacity, mapState.buffer.currentLiters);
    if (amount > 0) {
      mapState.buffer.currentLiters -= amount;
      litersShipped += amount;
      moneyEarned += amount * mapDef.pricePerLiter * productivity;
    }
    transport.timerMs -= intervalMs;
  }
  return { litersShipped, moneyEarned };
}

// Avance la chaîne d'un pas de temps réel (boucle active). Retourne les
// deltas pour que l'appelant les ajoute à l'économie globale (argent,
// litres livrés cumulés).
export function tickMap(mapState, mapDef, deltaMs, modifiers = NEUTRAL_MODIFIERS) {
  tickProducer(mapState, mapDef, deltaMs, modifiers);
  const { litersShipped, moneyEarned } = tickTransport(mapState, mapDef, deltaMs, modifiers);
  mapState.totalLitersShipped += litersShipped;
  return { litersShipped, moneyEarned };
}

// Calcul hors-ligne par formule (jamais une simulation seconde par
// seconde d'une absence de 24h) : en régime permanent, le débit réel est
// borné par le maillon le plus lent — production ou transport. C'est une
// approximation assumée et documentée, pas une vérité seconde-par-seconde ;
// voir le rapport V1 pour la justification.
export function computeMapOfflineProgress(mapState, mapDef, elapsedMs, modifiers = NEUTRAL_MODIFIERS) {
  const producerRate = producerRatePerMs(mapState, mapDef, modifiers);
  const transportRate = transportThroughputPerMs(mapState, mapDef, modifiers);
  const productivity = globalProductivityMultiplier(mapState, mapDef);
  // La productivité ne fait jamais physiquement circuler plus d'eau
  // qu'un seul maillon (production/transport) n'en autorise — elle
  // multiplie seulement l'argent gagné par litre vendu (voir
  // tickTransport, le chemin actif de référence). Appliquer le
  // multiplicateur AVANT litersShipped, comme le faisait un ancien
  // calcul, aurait fait progresser la carte plus vite hors-ligne qu'en
  // jeu actif pour un même achat — un vrai décalage entre les deux
  // chemins, jamais voulu.
  const effectiveRate = Math.min(producerRate, transportRate);
  const litersShipped = effectiveRate * elapsedMs;
  const moneyEarned = litersShipped * mapDef.pricePerLiter * productivity;
  // Le transport est le goulot dès qu'il ne peut pas absorber tout ce que
  // la production envoie : c'est alors le stockage qui sature, pas la
  // production qui manque de rythme.
  const transportIsBottleneck = producerRate >= transportRate;
  return { litersShipped, moneyEarned, transportIsBottleneck };
}

// Applique le résultat hors-ligne à l'état de la map, y compris une
// reconstruction honnête (approximative) de l'état visuel du tampon.
export function applyMapOfflineProgress(mapState, mapDef, elapsedMs, modifiers = NEUTRAL_MODIFIERS) {
  const result = computeMapOfflineProgress(mapState, mapDef, elapsedMs, modifiers);
  mapState.totalLitersShipped += result.litersShipped;
  const capacity = bufferCapacity(mapState, mapDef, modifiers);
  if (result.transportIsBottleneck) {
    mapState.buffer.currentLiters = capacity;
    mapState.producer.awaitingRoom = true;
    mapState.producer.stage = "outbound";
    mapState.producer.stageProgressMs = stageTotalMs(mapState, mapDef, modifiers, "outbound");
  } else {
    mapState.producer.awaitingRoom = false;
  }
  mapState.transport.timerMs = 0;
  return result;
}

// Phase du cycle en cours, pour l'animation du travailleur (jamais de
// téléportation brutale entre postes : l'UI lit cette phase à chaque
// image et positionne le personnage en conséquence).
//
// `extraMs` (V3, section 4 du cahier des charges post-bêta) : permet à
// l'UI d'extrapoler visuellement le temps écoulé depuis le dernier tick
// économique (ex. via requestAnimationFrame), SANS toucher à l'état réel
// du moteur. Cause exacte du petit saut observé sur Android une fois
// certains axes de vitesse au maximum : la boucle de rendu ne tournait
// qu'au rythme du tick économique (200ms, voir TICK_MS), alors qu'une
// phase au plancher visuel peut ne durer que 250-260ms — à peine plus
// d'une seule image de rendu, donc un déplacement qui saute au lieu de
// glisser. Jamais résolu en accélérant le tick économique (couteux en
// batterie pour un gain qui ne concerne que l'affichage) : `extraMs`
// laisse le rendu s'exécuter à la cadence de l'écran (souvent 60-120Hz)
// tout en gardant le calcul économique à sa cadence propre. Toujours
// borné à la durée totale de l'étape en cours : ne dépasse jamais dans
// la phase suivante avant que le tick réel ne l'ait confirmé.
export function currentProducerPhase(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS, extraMs = 0) {
  const producer = mapState.producer;
  if (producer.awaitingRoom) {
    return { key: "waitingForRoom", progress: 1, paused: true };
  }
  const durations = stageDurations(mapState, mapDef, modifiers, producer.stage);
  const totalMs = durations.reduce((sum, p) => sum + p.durationMs, 0);
  let acc = 0;
  const progressMs = Math.min(producer.stageProgressMs + Math.max(0, extraMs), totalMs);
  for (const phase of durations) {
    if (progressMs < acc + phase.durationMs) {
      return { key: phase.key, progress: (progressMs - acc) / phase.durationMs, paused: false };
    }
    acc += phase.durationMs;
  }
  const last = durations[durations.length - 1];
  return { key: last?.key ?? "prepare", progress: 1, paused: false };
}

// Pour l'UI : quel maillon limite le débit en ce moment, en langage
// compréhensible sans ouvrir un écran statistique (critère UX section 5.2).
export function bottleneckKind(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS) {
  if (mapState.producer.awaitingRoom) return "storageFull";
  const producerRate = producerRatePerMs(mapState, mapDef, modifiers);
  const transportRate = transportThroughputPerMs(mapState, mapDef, modifiers);
  if (producerRate >= transportRate * 0.9) return "transport";
  return "production";
}

export function progressRatio(mapState, mapDef) {
  return Math.min(1, mapState.totalLitersShipped / mapDef.mapCompleteLitersShipped);
}

export function isNextMapUnlocked(mapState, mapDef) {
  return mapState.totalLitersShipped >= mapDef.nextMapUnlockLitersShipped;
}
