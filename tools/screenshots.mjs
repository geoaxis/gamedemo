// Takes screenshots of fixed viewpoints so the look can be checked without playing.
// Usage: start `npm run dev`, then `node tools/screenshots.mjs [name ...]`
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.GAME_URL || 'http://localhost:5173/?auto=1';
const OUT = process.env.SHOT_DIR || 'shots';

// name: [x, z, camera yaw, pitch, distance, hour, settings in URL-parameter form]
const VIEWS = {
  start: [46, 20.5, Math.PI, 0.25, 6.5, 8],
  chowk: [66, 16, Math.PI, 0.3, 9, 10],
  street: [20, 20.5, Math.PI / 2, 0.2, 7, 9],
  home: [46, 33, 0, 0.5, 8, 11],
  mosque: [124, 3, -Math.PI / 2, 0.15, 12, 16],
  bridge: [-36, 20, -Math.PI / 2, 0.15, 8, 8.5],
  canal: [-50, 60, 2.6, 0.3, 10, 17.6],
  tubewell: [-121, 60, Math.PI, 0.35, 9, 12],
  fields: [-110, 20, -1.2, 0.45, 12, 13],
  shops: [86, 165, Math.PI, 0.2, 9, 15],
  road: [10, 170, Math.PI / 2, 0.2, 9, 9],
  pond: [150, 60, 0.5, 0.35, 10, 14],
  dusk: [60, 26, Math.PI, 0.3, 8, 18.3],
  night: [90, 166, Math.PI, 0.25, 9, 21],
  dawn: [-52, -40, 0.3, 0.2, 8, 6.4],
  rain: [60, 26, Math.PI, 0.3, 8, 15, 'weather=rain'],
  fog: [-110, 20, -1.2, 0.3, 9, 6.8, 'weather=fog'],
};

const wanted = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 }).catch(() => {});
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));

for (const [name, [x, z, yaw, pitch, dist, hour, params = '']] of Object.entries(VIEWS)) {
  if (wanted.length && !wanted.includes(name)) continue;
  const weather = new URLSearchParams(params).get('weather') || 'clear';
  await page.evaluate(([x, z, yaw, pitch, dist, hour, weather]) => {
    const g = window.__game;
    g.weather.setForce(weather); g.hour(hour); g.look(x, z, yaw, pitch, dist);
  }, [x, z, yaw, pitch, dist, hour, weather]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, quality: 80 });
  console.log('saved', name);
}
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) res(n / 2); else requestAnimationFrame(f); }; f(); }));
const info = await page.evaluate(() => window.__game?.renderer.info.render);
console.log('fps', fps, JSON.stringify(info));
await browser.close();
