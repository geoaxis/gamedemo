// Plays through the main interactions and saves screenshots. Needs `npm run dev` running.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR || 'shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (n) => page.screenshot({ path: `${OUT}/play-${n}.jpg`, quality: 80 });
const g = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(process.env.GAME_URL || 'http://localhost:5173/');
await page.waitForFunction(() => window.__game);
await page.waitForSelector('#start:not([disabled])');
await wait(500);
await shot('title');
await page.click('#start');
await wait(1500);

// talk to Uncle Bashir
await g(() => { __game.hour(10); __game.look(62.3, 9.6, -1.6, 0.25, 5); });
await wait(600);
await page.keyboard.press('KeyE');
await wait(600);
await shot('talk');

// walk forward for two seconds
const before = await g(() => ({ x: __game.player.x, z: __game.player.z }));
await page.keyboard.down('KeyW'); await wait(2000); await page.keyboard.up('KeyW');
const after = await g(() => ({ x: __game.player.x, z: __game.player.z }));
console.log('walked', Math.hypot(after.x - before.x, after.z - before.z).toFixed(2), 'm');

// drive the tractor
await g(() => { const s = __game.tractor.seatWorld; __game.look(s.x, s.z - 2, -Math.PI / 2, 0.3, 7); });
await wait(600);
await shot('tractor-prompt');
await page.keyboard.press('KeyE');
await wait(500);
console.log('mode after E:', await g(() => __game.player.mode));
const t0 = await g(() => ({ x: __game.tractor.x, z: __game.tractor.z }));
await page.keyboard.down('KeyW'); await wait(3000);
await page.keyboard.down('KeyA'); await wait(1500); await page.keyboard.up('KeyA');
await shot('driving');
await page.keyboard.press('KeyH');
await page.keyboard.up('KeyW');
const t1 = await g(() => ({ x: __game.tractor.x, z: __game.tractor.z, sp: __game.tractor.speed }));
console.log('tractor moved', Math.hypot(t1.x - t0.x, t1.z - t0.z).toFixed(1), 'm, speed', t1.sp.toFixed(1));
await page.keyboard.down('KeyS'); await wait(1800); await page.keyboard.up('KeyS');
await wait(2500);
await page.keyboard.press('KeyE');
await wait(400);
console.log('mode after second E:', await g(() => __game.player.mode));

// start the tube well
await g(() => { __game.hour(12); __game.look(__game.tubewell.x, __game.tubewell.z + 0.6, Math.PI, 0.3, 6); });
await wait(600);
await page.keyboard.press('KeyE');
await wait(2500);
console.log('tube well on:', await g(() => __game.tubewell.on));
await shot('tubewell-on');

// sit on the charpai there, then get up
await g(() => { const c = __game.tubewell.charpai; __game.look(c.x + 1.2, c.z, 2, 0.35, 5); });
await wait(500);
await page.keyboard.press('KeyE');
await wait(700);
console.log('mode on charpai:', await g(() => __game.player.mode));
await shot('sitting');
await page.keyboard.press('KeyE');
await wait(300);
console.log('mode after getting up:', await g(() => __game.player.mode));

// subtitles off, truck passing
await page.keyboard.press('KeyT');
await g(() => { __game.hour(16.5); __game.look(-20, 163.5, 0.6, 0.15, 7); });
await wait(300);
for (let i = 0; i < 60; i++) {
  const x = await g(() => __game.traffic?.truck.x ?? null);
  if (x === null) break;
  if (x > -45 && x < -25) break;
  await wait(500);
}
await shot('truck');
console.log('audio state:', await g(() => __game.sound?.ctx?.state), 'buffers:', await g(() => Object.keys(__game.sound?.buffers || {}).length));
console.log(errors.length ? 'ERRORS/WARNINGS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
await browser.close();
