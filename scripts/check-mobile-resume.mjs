// Test de non-régression mobile : reproduit en Playwright headless le
// cycle "quitter puis revenir" qui rendait les taps morts en bêta réelle
// (cause probable : visibilitychange peu fiable en PWA standalone iOS,
// sans filet si une exception survenait pendant la reprise — voir le
// commentaire dans src/main.js pour le diagnostic complet), et vérifie
// l'absence de débordement horizontal à plusieurs largeurs portrait
// (le layout ne doit jamais dépendre d'une interaction pour se corriger).
//
// Lance son propre serveur de build (vite preview) : `npm run build` doit
// avoir tourné avant, ou ce script le fait lui-même si dist/ est absent.

import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

function log(...args) {
  console.log("[test-mobile-resume]", ...args);
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  if (!existsSync(join(ROOT, "dist", "index.html"))) {
    log("dist/ absent, build...");
    const build = spawnSync("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit" });
    if (build.status !== 0) throw new Error("build a échoué");
  }

  log("démarrage de vite preview...");
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  });

  let failures = 0;
  try {
    const ready = await waitForServer(BASE_URL, 20_000);
    if (!ready) throw new Error("le serveur de preview n'a jamais répondu");

    // Le chromium pré-installé de cet environnement (voir PLAYWRIGHT_BROWSERS_PATH)
    // peut être une révision différente de celle attendue par la version de
    // playwright installée localement — on pointe dessus explicitement plutôt
    // que de forcer un téléchargement.
    const knownChromiumPath = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
    const browser = await chromium.launch({
      executablePath: existsSync(knownChromiumPath) ? knownChromiumPath : undefined,
      args: ["--no-sandbox"],
    });

    // --- Test 1 : reprise après mise en arrière-plan simulée ---
    {
      const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console: ${m.text()}`);
      });

      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForSelector("#drawer-handle");

      await page.click("#drawer-handle"); // ouvre
      await page.waitForTimeout(100);
      await page.click("#drawer-handle"); // referme, pour repartir d'un état connu
      await page.waitForTimeout(100);
      const before = await page.getAttribute("#drawer", "data-open"); // "false" attendu

      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("blur"));
        window.dispatchEvent(new Event("pagehide"));
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("pageshow", { bubbles: true }));
        window.dispatchEvent(new Event("focus"));
      });
      await page.waitForTimeout(300);

      await page.click("#drawer-handle");
      await page.waitForTimeout(100);
      const after = await page.getAttribute("#drawer", "data-open");

      const interactionStillWorks = before === "false" && after === "true";
      if (!interactionStillWorks) {
        failures += 1;
        log("ÉCHEC : le tiroir ne réagit plus au clic après une reprise simulée", { before, after });
      } else {
        log("OK : le clic fonctionne toujours après suspend/resume simulé", { before, after });
      }
      if (errors.length > 0) {
        failures += 1;
        log("ÉCHEC : erreurs console pendant le cycle suspend/resume", errors);
      } else {
        log("OK : aucune erreur console pendant le cycle suspend/resume");
      }
      await page.close();
    }

    // --- Test 3 : le crédit hors-ligne n'est jamais compté deux fois pour
    // la même absence, même si plusieurs signaux de reprise se déclenchent
    // (visibilitychange + focus + pageshow) juste après le calcul initial ---
    {
      const craftedSave = {
        version: 2,
        money: 0,
        totalMoneyEarnedThisRun: 0,
        perles: 0,
        prestigeCount: 0,
        currentMapId: "water",
        maps: {
          water: {
            producer: { bucketLevel: 1, movementLevel: 1, winchLevel: 1, wellLevel: 1, cycleProgressMs: 0, paused: false },
            buffer: { level: 1, currentLiters: 0 },
            transport: { capacityLevel: 1, frequencyLevel: 1, timerMs: 0 },
            globalProductivityLevel: 1,
            totalLitersShipped: 0,
          },
        },
        perks: {},
        audio: { muted: false, volume: 0.5 },
        tutorial: { seen: {} },
        telemetry: { sessions: [], returns: [], unlocks: [], prestiges: [] },
        ui: {},
        lastSeen: Date.now() - 70_000, // 70s d'absence simulée, déjà présente au chargement
        createdAt: Date.now() - 200_000,
      };
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addInitScript((save) => {
        localStorage.setItem("haven-v0-save", JSON.stringify(save));
      }, craftedSave);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForSelector("#money-value");
      await page.waitForTimeout(300);
      const moneyAfterBoot = await page.textContent("#money-value");

      // Signaux de reprise redondants, comme un vrai retour PWA multiplie
      // parfois visibilitychange/focus/pageshow pour un seul événement réel.
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("pageshow", { bubbles: true }));
      });
      await page.waitForTimeout(300);
      const moneyAfterRedundantSignals = await page.textContent("#money-value");

      if (moneyAfterRedundantSignals !== moneyAfterBoot) {
        failures += 1;
        log("ÉCHEC : le crédit hors-ligne a été compté une seconde fois pour la même absence", {
          moneyAfterBoot,
          moneyAfterRedundantSignals,
        });
      } else {
        log("OK : le crédit hors-ligne reste idempotent malgré des signaux de reprise redondants", { moneyAfterBoot });
      }
      if (errors.length > 0) {
        failures += 1;
        log("ÉCHEC : erreurs pendant le test d'idempotence hors-ligne", errors);
      }
      await page.close();
    }

    // --- Test 2 : pas de débordement horizontal à plusieurs largeurs portrait ---
    {
      for (const width of [320, 360, 390, 414, 480]) {
        const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage();
        await page.goto(BASE_URL, { waitUntil: "networkidle" });
        const info = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          appWidth: document.getElementById("app").getBoundingClientRect().width,
        }));
        const overflow = info.scrollWidth > info.clientWidth;
        const fullWidth = Math.round(info.appWidth) === width || width > 520;
        if (overflow || !fullWidth) {
          failures += 1;
          log(`ÉCHEC largeur ${width}px :`, info);
        } else {
          log(`OK largeur ${width}px : pleine largeur, aucun débordement`);
        }
        await page.close();
      }
    }

    await browser.close();
  } finally {
    server.kill();
  }

  if (failures > 0) {
    log(`${failures} échec(s).`);
    process.exit(1);
  }
  log("Tous les tests mobiles sont passés.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
