// Things the player can use with the E key. Each item gives its position, how close you
// need to be, which prompt to show (or null when it cannot be used) and what happens.

export class Interactions {
  constructor() { this.items = []; }

  add(item) { this.items.push(item); return item; }

  // Closest usable item to the player, or null.
  find(player) {
    let best = null, bestD = Infinity;
    for (const it of this.items) {
      const p = it.at();
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      const score = d - (it.priority || 0);
      if (d > it.r || score >= bestD) continue;
      const prompt = it.prompt(player);
      if (!prompt) continue;
      best = { item: it, prompt };
      bestD = score;
    }
    return best;
  }
}
