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
      await page.waitForSelector("#tap-zone");
      const box = await page.locator("#tap-zone").boundingBox();

      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(100);
      const before = await page.textContent("#vitality-value");

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

      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(100);
      const after = await page.textContent("#vitality-value");

      const tapStillWorks = parseFloat(after) > parseFloat(before);
      if (!tapStillWorks) {
        failures += 1;
        log("ÉCHEC : le tap n'a plus d'effet après une reprise simulée", { before, after });
      } else {
        log("OK : le tap fonctionne toujours après suspend/resume simulé", { before, after });
      }
      if (errors.length > 0) {
        failures += 1;
        log("ÉCHEC : erreurs console pendant le cycle suspend/resume", errors);
      } else {
        log("OK : aucune erreur console pendant le cycle suspend/resume");
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
