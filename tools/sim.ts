// Headless balance check: an AI player plays every stage. Run: npm run sim [-- difficulty]
import { Game } from '../src/sim/game.ts';
import { STAGES, type Mode } from '../src/data/stages.ts';
import { TOWER, LINE_INFO, type TowerLine } from '../src/data/towers.ts';
import { UPGRADES, emptyUpgrades, type UpgradeState } from '../src/data/upgrades.ts';
import { HERO_XP } from '../src/data/heroes.ts';

const diff = Number(process.argv[2] ?? 1);
const skill = Number(process.argv[3] ?? 1); // 0 = weak AI, 1 = decent AI
const only = process.argv[4] != null ? Number(process.argv[4]) : -1;
const modeArg = (process.argv[5] ?? 'campaign') as Mode;

function upgradesFor(stars: number): UpgradeState {
  const up = emptyUpgrades();
  let s = stars;
  // spend evenly by level across tracks
  for (let lv = 0; lv < 5; lv++) {
    for (const t of UPGRADES) {
      const c = t.levels[lv].cost;
      if (s >= c) { s -= c; up[t.id] = lv + 1; }
    }
  }
  return up;
}

function play(stageIdx: number, mode: Mode, stars: number, heroXp: number) {
  const st = STAGES[stageIdx];
  const g = new Game({ stage: st, mode, difficulty: diff, upgrades: upgradesFor(stars), hero: { id: 'kokka', xp: heroXp } });
  const pattern: TowerLine[] = (skill ? ['archer', 'barracks', 'mage', 'artillery', 'archer', 'mage', 'barracks', 'artillery', 'archer', 'mage'] : ['archer', 'archer', 'barracks', 'archer', 'mage']) as TowerLine[];
  const allowed = pattern.filter((l) => g.allowedLine(l));
  let bi = 0;
  const cover = new Map<number, number>();
  for (const sp of g.spots) {
    let c = 0;
    for (const p of g.paths) for (let i = 0; i < p.pts.length; i += 4) if (Math.hypot(p.pts[i].x - sp.x, p.pts[i].y - sp.y) < 8) c++;
    cover.set(sp.id, c);
  }
  const branchPick = new Map<string, number>();
  const dt = 1 / 30;
  g.callWave();
  let acc = 0;
  const leaks = new Map<string, number>();
  while (g.state === 'playing' && g.time < 1500) {
    g.update(dt);
    for (const ev of g.events) if (ev.type === 'lifeLost') leaks.set(ev.e.def.id, (leaks.get(ev.e.def.id) ?? 0) + ev.amount);
    g.events.length = 0;
    acc += dt;
    if (acc < 0.5) continue;
    acc = 0;
    // spells
    if (skill && g.meteorCd <= 0 && g.enemies.length > 4) {
      let best = null as null | { x: number; y: number }, bc = 0;
      for (const e of g.enemies) {
        if (e.def.flying) continue;
        const c = g.enemies.filter((o) => Math.hypot(o.x - e.x, o.y - e.y) < 2.5).length + e.d / e.path.length * 3;
        if (c > bc) { bc = c; best = e; }
      }
      if (best && bc >= 4) g.castMeteor(best);
    }
    if (skill && g.reinforceCd <= 0 && g.enemies.length) {
      const e = [...g.enemies].filter((x) => !x.def.flying).sort((a, b) => (b.d / b.path.length) - (a.d / a.path.length))[0];
      if (e && e.d / e.path.length > 0.55) g.castReinforce(e);
    }
    // economy
    for (let k = 0; k < 3; k++) {
      const free = g.spots.filter((s) => !g.towers.some((t) => t.spot === s.id)).sort((a, b) => (skill ? cover.get(b.id)! - cover.get(a.id)! : 0));
      const minTier = Math.min(...g.towers.map((t) => t.def.tier), 9);
      const wantBuild = free.length > 0 && (g.towers.length < 4 || minTier >= 2 || g.towers.length < g.spots.length * 0.6);
      if (wantBuild) {
        const line = allowed[bi % allowed.length];
        const cost = g.towerCost(TOWER[LINE_INFO[line].base]);
        if (g.gold >= cost) { g.build(free[0].id, LINE_INFO[line].base); bi++; continue; }
        break;
      }
      // upgrade cheapest-tier tower
      const sorted = [...g.towers].sort((a, b) => a.def.tier - b.def.tier);
      let did = false;
      for (const t of sorted) {
        if (t.def.next.length) {
          const pick = branchPick.get(t.def.line) ?? 0;
          const to = t.def.next.length > 1 ? t.def.next[pick % 2] : t.def.next[0];
          if (g.gold >= g.towerCost(TOWER[to])) {
            g.upgrade(t, to);
            if (t.def.next.length === 0 && TOWER[to].tier === 4) branchPick.set(t.def.line, pick + 1);
            did = true;
          }
          break;
        } else if (t.def.abilities && skill) {
          for (const a of t.def.abilities) {
            const c = g.abilityCost(t, a.id);
            if (c != null && g.gold >= c) { g.buyAbility(t, a.id); did = true; break; }
          }
          if (did) break;
        }
      }
      if (!did) break;
    }
  }
  return { won: g.state === 'won', lives: g.lives, wave: g.waveIdx + 1, waves: g.waves.length, time: Math.round(g.time), stars: g.stars(), gold: g.gold, xp: g.heroXpGained, towers: g.towers.map((t) => t.def.id).join(','), leaks: [...leaks].map(([k, v]) => k + ':' + v).join(' ') };
}

let stars = 0;
let xp = 0;
for (let i = 0; i < STAGES.length; i++) {
  if (only >= 0 && i !== only) { stars += 2; xp = HERO_XP[Math.min(9, Math.floor(i * 0.6))]; continue; }
  const r = play(i, modeArg, stars, xp);
  console.log(`${String(i + 1).padStart(2)} ${STAGES[i].name.padEnd(10, '　')} ${r.won ? 'WIN ' : 'LOSE'} lives=${String(r.lives).padStart(2)} wave=${r.wave}/${r.waves} t=${r.time}s stars=${r.stars} leftGold=${r.gold} xp+${Math.round(r.xp)} ${r.leaks}${process.env.T ? "\n   " + r.towers : ""}`);
  stars += Math.max(1, r.stars);
  xp += r.xp;
}
