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

// Fait avancer le cycle du travailleur de deltaMs. S'arrête (paused) une
// fois le seau prêt si le stockage n'a plus de place — l'inefficacité
// devient une animation, jamais un blocage du jeu.
function tickProducer(mapState, mapDef, deltaMs, modifiers) {
  const producer = mapState.producer;
  const cycleMs = producerCycleMs(mapState, mapDef, modifiers);
  const bucketLiters = producerBucketLiters(mapState, mapDef, modifiers);
  const capacity = bufferCapacity(mapState, mapDef, modifiers);

  if (producer.paused) {
    const room = capacity - mapState.buffer.currentLiters;
    if (room >= bucketLiters) {
      mapState.buffer.currentLiters += bucketLiters;
      producer.paused = false;
      producer.cycleProgressMs = 0;
    }
    return;
  }

  producer.cycleProgressMs += deltaMs;
  while (producer.cycleProgressMs >= cycleMs) {
    const room = capacity - mapState.buffer.currentLiters;
    if (room >= bucketLiters) {
      mapState.buffer.currentLiters += bucketLiters;
      producer.cycleProgressMs -= cycleMs;
    } else {
      producer.paused = true;
      producer.cycleProgressMs = cycleMs;
      break;
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
  const effectiveRate = Math.min(producerRate, transportRate) * productivity;
  const litersShipped = effectiveRate * elapsedMs;
  const moneyEarned = litersShipped * mapDef.pricePerLiter;
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
    mapState.producer.paused = true;
    mapState.producer.cycleProgressMs = producerCycleMs(mapState, mapDef, modifiers);
  } else {
    mapState.producer.paused = false;
  }
  mapState.transport.timerMs = 0;
  return result;
}

// Phase du cycle en cours, pour l'animation du travailleur (jamais de
// téléportation brutale entre postes : l'UI lit cette phase à chaque
// image et positionne le personnage en conséquence).
export function currentProducerPhase(mapState, mapDef, modifiers = NEUTRAL_MODIFIERS) {
  if (mapState.producer.paused) {
    return { key: "waitingForRoom", progress: 1, paused: true };
  }
  const durations = producerPhaseDurations(mapState, mapDef, modifiers);
  let acc = 0;
  const progressMs = mapState.producer.cycleProgressMs;
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
  if (mapState.producer.paused) return "storageFull";
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
