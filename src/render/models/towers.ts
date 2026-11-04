import { MB, part, type RigPart, type Vec3 } from '../builder.ts';

export interface TowerRig {
  body: BuiltGeo;
  glow?: BuiltGeo;
  turret?: RigPart;
  orb?: RigPart;
  crew: { model: string; pos: Vec3; turret?: boolean }[];
  top: number;
}
type BuiltGeo = ReturnType<MB['build']>;

const STONE = 0xb8b2a6, STONE_D = 0x8f897e, STONE_L = 0xd6d0c4;
const WOOD = 0x9a6233, WOOD_D = 0x6e4322, WOOD_L = 0xc08048;
const ROOF_R = 0xd9473a, ROOF_B = 0x3d6fb5, GOLD = 0xffc93c;

export function egg(mb: MB, r: number, pos: Vec3, colors: number[], glow = false) {
  const [x, y, z] = pos;
  mb.sphere(r, colors[0], [x, y, z], [1, 1.3, 1], 18);
  const bands = colors.slice(1);
  bands.forEach((c, i) => {
    const t = -0.55 + (i + 0.5) * (1.1 / bands.length);
    const ry = y + t * r * 1.3;
    const w = Math.sqrt(Math.max(0.05, 1 - t * t)) * r * 1.01;
    mb.cyl(w, w, r * 0.22, c, [x, ry, z], [0, 0, 0], 18);
  });
  void glow;
}

function plinth(mb: MB, r = 1.25, h = 0.35) {
  mb.cyl(r * 1.05, r * 1.12, 0.12, 0x7a6a50, [0, 0.06, 0], [0, 0, 0], 20);
  mb.cyl(r, r * 1.04, h, STONE, [0, 0.06 + h / 2, 0], [0, 0, 0], 16);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    mb.box(0.32, h * 0.8, 0.12, i % 2 ? STONE_D : STONE_L, [Math.cos(a) * r * 0.99, 0.06 + h / 2, Math.sin(a) * r * 0.99], [0, -a, 0], 0.03);
  }
  return 0.06 + h;
}

function crenellations(mb: MB, r: number, y: number, n: number, color = STONE) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    mb.box(0.28, 0.28, 0.22, color, [Math.cos(a) * r, y + 0.14, Math.sin(a) * r], [0, -a, 0], 0.04);
  }
}

function flag(mb: MB, pos: Vec3, color: number, h = 1.2) {
  mb.cyl(0.03, 0.03, h, WOOD_D, [pos[0], pos[1] + h / 2, pos[2]]);
  mb.box(0.45, 0.3, 0.03, color, [pos[0] + 0.24, pos[1] + h - 0.2, pos[2]], [0, 0, 0], 0.01);
  mb.sphere(0.05, GOLD, [pos[0], pos[1] + h, pos[2]]);
}

function stoneTower(mb: MB, rb: number, rt: number, y0: number, h: number, color = STONE) {
  mb.cyl(rt, rb, h, color, [0, y0 + h / 2, 0], [0, 0, 0], 14);
  // stone blocks for texture
  for (let k = 0; k < Math.floor(h / 0.45); k++) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + k * 0.5;
      const yy = y0 + 0.25 + k * 0.45;
      const rr = rb + (rt - rb) * ((yy - y0) / h);
      mb.box(0.3, 0.2, 0.08, (i + k) % 3 === 0 ? STONE_D : STONE_L, [Math.cos(a) * rr, yy, Math.sin(a) * rr], [0, -a + Math.PI / 2, 0], 0.03);
    }
  }
}

function coneRoof(mb: MB, r: number, h: number, y: number, color: number) {
  mb.cone(r, h, color, [0, y + h / 2, 0], [0, 0, 0], 12);
  mb.cyl(r * 1.02, r * 1.02, 0.08, 0x5a3a20, [0, y + 0.04, 0], [0, 0, 0], 12);
  mb.sphere(0.08, GOLD, [0, y + h + 0.05, 0]);
}

// ───────────────────────── archer line ─────────────────────────
function archer(tier: number, kind?: 'hawkeye' | 'gatling'): TowerRig {
  const mb = new MB();
  const y0 = plinth(mb);
  let top: number;
  const crew: TowerRig['crew'] = [];
  let turret: RigPart | undefined;
  if (tier === 1) {
    for (const [x, z] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) mb.cyl(0.1, 0.12, 1.8, WOOD, [x, y0 + 0.9, z], [0, 0, 0], 8);
    mb.box(0.9, 0.08, 0.06, WOOD_D, [0, y0 + 0.8, 0.6], [0, 0, 0.6]);
    mb.box(0.9, 0.08, 0.06, WOOD_D, [0, y0 + 0.8, -0.6], [0, 0, -0.6]);
    mb.box(1.6, 0.16, 1.6, WOOD_L, [0, y0 + 1.8, 0], [0, 0, 0], 0.04);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      mb.box(1.6, 0.35, 0.08, WOOD, [Math.cos(a) * 0.76, y0 + 2.05, Math.sin(a) * 0.76], [0, -a + Math.PI / 2, 0], 0.02);
    }
    flag(mb, [0.7, y0 + 1.9, -0.7], 0x4caf50, 1.0);
    top = y0 + 1.9;
    crew.push({ model: 'archer_chick', pos: [0, top, 0] });
  } else if (tier === 2) {
    stoneTower(mb, 1.0, 0.85, y0, 1.6);
    mb.cyl(1.05, 0.95, 0.18, WOOD_L, [0, y0 + 1.7, 0], [0, 0, 0], 14);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mb.cyl(0.06, 0.06, 1.2, WOOD, [Math.cos(a) * 0.95, y0 + 2.3, Math.sin(a) * 0.95], [0, 0, 0], 6);
    }
    coneRoof(mb, 1.3, 0.9, y0 + 2.85, ROOF_R);
    top = y0 + 1.8;
    crew.push({ model: 'archer_hen', pos: [0.35, top, 0.1] }, { model: 'archer_hen', pos: [-0.35, top, -0.1] });
  } else if (tier === 3 || kind) {
    const h = kind === 'hawkeye' ? 3.4 : 2.4;
    stoneTower(mb, 1.05, 0.9, y0, h);
    mb.cyl(1.15, 1.0, 0.25, STONE_L, [0, y0 + h + 0.1, 0], [0, 0, 0], 14);
    crenellations(mb, 1.05, y0 + h + 0.2, 8);
    mb.box(0.5, 0.7, 0.05, ROOF_B, [0, y0 + h * 0.55, 0.95], [0, 0, 0], 0.02);
    mb.sphere(0.12, GOLD, [0, y0 + h * 0.55 + 0.1, 0.99]);
    top = y0 + h + 0.25;
    if (kind === 'hawkeye') {
      flag(mb, [-0.8, top, -0.6], ROOF_B, 1.4);
      flag(mb, [0.8, top, -0.6], ROOF_B, 1.4);
      // eagle statue
      mb.sphere(0.22, 0xe8e0d0, [0, top - 0.85, 1.02], [1, 1, 0.6]);
      mb.cone(0.08, 0.2, GOLD, [0, top - 0.85, 1.25], [Math.PI / 2, 0, 0], 6);
      crew.push({ model: 'ranger', pos: [0, top, 0] });
    } else if (kind === 'gatling') {
      turret = part('turret', [0, top, 0], (m) => {
        m.cyl(0.45, 0.5, 0.3, 0x6b4a2b, [0, 0.15, 0], [0, 0, 0], 12);
        m.box(0.7, 0.45, 0.7, 0x8a5a2b, [0, 0.5, -0.1], [0, 0, 0], 0.06);
        // corn gatling
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          m.cyl(0.07, 0.07, 1.1, i % 2 ? 0xffd24a : 0xf0b020, [Math.cos(a) * 0.16, 0.6 + Math.sin(a) * 0.16, 0.65], [Math.PI / 2, 0, 0], 8);
        }
        m.cyl(0.25, 0.25, 0.15, 0x6b6b78, [0, 0.6, 0.15], [Math.PI / 2, 0, 0], 12);
        m.cyl(0.25, 0.25, 0.1, 0x6b6b78, [0, 0.6, 1.15], [Math.PI / 2, 0, 0], 12);
        m.box(0.3, 0.25, 0.3, 0xffd24a, [0.45, 0.45, -0.25], [0, 0, 0], 0.04);
      });
      crew.push({ model: 'gunner', pos: [0, top + 0.3, -0.6], turret: true });
    } else {
      flag(mb, [0.8, top, -0.6], 0x4caf50, 1.2);
      crew.push({ model: 'archer_hen', pos: [0.4, top, 0.1] }, { model: 'archer_hen', pos: [-0.4, top, -0.1] });
    }
  } else top = 3;
  return { body: mb.build(), crew, turret, top };
}

// ───────────────────────── barracks line ─────────────────────────
function coop(mb: MB, y0: number, w: number, d: number, h: number, wall: number, roof: number) {
  mb.box(w, h, d, wall, [0, y0 + h / 2, 0], [0, 0, 0], 0.05);
  for (let i = 0; i < 4; i++) mb.box(w + 0.02, 0.06, 0.04, WOOD_D, [0, y0 + 0.2 + i * (h / 4), d / 2 + 0.01]);
  // A-frame roof
  const rl = Math.hypot(w / 2, 0.7) + 0.15;
  mb.box(rl, 0.12, d + 0.3, roof, [w / 4, y0 + h + 0.33, 0], [0, 0, -Math.atan2(0.7, w / 2)], 0.03);
  mb.box(rl, 0.12, d + 0.3, roof, [-w / 4, y0 + h + 0.33, 0], [0, 0, Math.atan2(0.7, w / 2)], 0.03);
  // gable
  mb.cone(w / 2 * 1.0, 0.7, wall, [0, y0 + h + 0.33, d / 2 - 0.05], [0, 0, 0], 3, [1, 1, 0.12]);
  mb.cone(w / 2 * 1.0, 0.7, wall, [0, y0 + h + 0.33, -d / 2 + 0.05], [0, 0, 0], 3, [1, 1, 0.12]);
  // door + window
  mb.box(0.45, 0.6, 0.06, 0x4a2e18, [0, y0 + 0.3, d / 2 + 0.03], [0, 0, 0], 0.05);
  mb.cyl(0.13, 0.13, 0.06, 0x2a1a10, [0, y0 + h + 0.15, d / 2 + 0.03], [Math.PI / 2, 0, 0], 10);
  // ramp
  mb.box(0.4, 0.05, 0.6, WOOD_L, [0, y0 + 0.1, d / 2 + 0.3], [0.3, 0, 0]);
}

function barracks(tier: number, kind?: 'paladin' | 'berserker'): TowerRig {
  const mb = new MB();
  const y0 = plinth(mb, 1.3, 0.25);
  let top = 2;
  if (kind === 'paladin') {
    mb.box(1.7, 1.3, 1.4, 0xf2efe6, [0, y0 + 0.65, 0], [0, 0, 0], 0.06);
    mb.box(0.55, 0.85, 0.06, 0x7a5a3a, [0, y0 + 0.43, 0.71], [0, 0, 0], 0.08);
    stoneTower(mb, 0.55, 0.5, y0, 2.4, 0xf2efe6);
    mb.sphere(0.6, GOLD, [0, y0 + 2.4, 0], [1, 0.9, 1]);
    mb.cyl(0.03, 0.03, 0.6, GOLD, [0, y0 + 3.2, 0]);
    mb.box(0.3, 0.05, 0.05, GOLD, [0, y0 + 3.35, 0]);
    mb.box(1.8, 0.15, 1.5, ROOF_B, [0, y0 + 1.35, 0], [0, 0, 0], 0.05);
    flag(mb, [0.9, y0 + 1.3, 0.6], ROOF_B, 1.0);
    flag(mb, [-0.9, y0 + 1.3, 0.6], ROOF_B, 1.0);
    top = y0 + 3.4;
  } else if (kind === 'berserker') {
    coop(mb, y0, 1.7, 1.4, 1.0, 0x8a3a2a, 0x5a2a1a);
    for (const sx of [-1, 1]) {
      mb.cyl(0.25, 0.25, 0.06, 0xb0b8c0, [sx * 0.88, y0 + 0.6, 0.3], [0, 0, Math.PI / 2], 12);
      mb.cyl(0.1, 0.1, 0.07, GOLD, [sx * 0.9, y0 + 0.6, 0.3], [0, 0, Math.PI / 2], 8);
    }
    mb.cone(0.12, 0.6, 0xf5ecd7, [0.55, y0 + 1.95, 0.7], [0, 0, -0.8], 6);
    mb.cone(0.12, 0.6, 0xf5ecd7, [-0.55, y0 + 1.95, 0.7], [0, 0, 0.8], 6);
    mb.cyl(0.04, 0.04, 1.0, WOOD_D, [0.85, y0 + 0.5, 0.85], [0, 0, 0.3]);
    mb.box(0.06, 0.3, 0.35, 0xc8ced6, [0.95, y0 + 0.95, 0.95], [0, 0, 0.3], 0.03);
    flag(mb, [-0.8, y0 + 1.0, -0.7], 0xc0392b, 1.2);
    top = y0 + 2;
  } else {
    if (tier >= 2) mb.box(1.9, 0.35, 1.6, STONE, [0, y0 + 0.17, 0], [0, 0, 0], 0.06);
    const yy = y0 + (tier >= 2 ? 0.35 : 0);
    const w = tier === 1 ? 1.4 : 1.6;
    coop(mb, yy, w, 1.25, tier === 3 ? 1.0 : 0.85, tier === 3 ? 0xd8c8a8 : 0xe8d0a0, tier === 3 ? ROOF_B : ROOF_R);
    if (tier === 3) {
      for (const sx of [-1, 1]) {
        mb.cone(0.42, 0.6, ROOF_B, [sx * 0.95, y0 + 2.2, -0.55], [0, 0, 0], 8);
        mb.cyl(0.32, 0.32, 1.9, STONE, [sx * 0.95, y0 + 0.95, -0.55], [0, 0, 0], 10);
      }
    }
    flag(mb, [w / 2 + 0.05, yy + 0.4, 0.55], tier === 3 ? ROOF_B : 0xffc93c, 1.1);
    top = yy + 1.7;
  }
  return { body: mb.build(), crew: [], top };
}

// ───────────────────────── mage line ─────────────────────────
const RAINBOW = [0xb57cff, 0xff6fae, 0xffd24a, 0x6fd6ff, 0x7be37b];
function mage(tier: number, kind?: 'arcane' | 'frost'): TowerRig {
  const mb = new MB();
  const y0 = plinth(mb, 1.15, 0.3);
  const h = kind ? 2.8 : 1.4 + tier * 0.5;
  const wall = kind === 'frost' ? 0xcfe6f5 : kind === 'arcane' ? 0x8a7ab8 : 0xb8a8d8;
  stoneTower(mb, 0.85, 0.65, y0, h, wall);
  // balcony + crystal pillars
  mb.cyl(0.95, 0.75, 0.2, kind === 'frost' ? 0xa8d8f5 : 0x6a4fa8, [0, y0 + h, 0], [0, 0, 0], 14);
  const pillars = kind ? 4 : tier + 1;
  for (let i = 0; i < pillars; i++) {
    const a = (i / pillars) * Math.PI * 2 + 0.4;
    mb.cone(0.12, 0.6 + tier * 0.1, kind === 'frost' ? 0xbff0ff : 0xd9b3ff, [Math.cos(a) * 0.75, y0 + h + 0.35, Math.sin(a) * 0.75], [0, 0, 0], 5);
  }
  // door + windows
  mb.box(0.4, 0.6, 0.05, 0x4a2e58, [0, y0 + 0.3, 0.84], [0, 0, 0], 0.08);
  mb.cyl(0.1, 0.1, 0.05, 0xffe66b, [0, y0 + h * 0.6, 0.72], [Math.PI / 2, 0, 0], 10);
  const top = y0 + h + 0.1;
  let orb: RigPart;
  if (kind === 'arcane') {
    orb = part('orb', [0, top + 1.0, 0], (m) => {
      m.sphere(0.5, 0x2a2060, [0, 0, 0]);
      for (let i = 0; i < 8; i++) m.sphere(0.06, 0xffffff, [Math.cos(i * 2.1) * 0.45, Math.sin(i * 1.3) * 0.3, Math.sin(i * 2.1) * 0.45 * 0.9]);
      m.torus(0.75, 0.04, GOLD, [0, 0, 0], [Math.PI / 2 + 0.3, 0, 0]);
      m.torus(0.68, 0.04, GOLD, [0, 0, 0], [0.4, 0.8, 0]);
      m.cone(0.08, 0.2, GOLD, [0, 0.65, 0], [0, 0, 0], 4);
    });
    // telescope
    mb.cyl(0.08, 0.12, 0.9, 0x8a6a3a, [0.5, top + 0.3, -0.3], [-0.8, 0, -0.3], 10);
  } else if (kind === 'frost') {
    orb = part('orb', [0, top + 0.95, 0], (m) => {
      egg(m, 0.42, [0, 0, 0], [0xdff6ff, 0x9fd8ff, 0xffffff, 0x6fbfff]);
      for (let i = 0; i < 6; i++) m.cone(0.07, 0.4, 0xe8fbff, [Math.cos(i) * 0.4, Math.sin(i * 3) * 0.2, Math.sin(i) * 0.4], [Math.sin(i), 0, Math.cos(i)], 4);
    });
    for (let i = 0; i < 5; i++) mb.ico(0.18, 0xd8f4ff, [Math.cos(i * 1.3) * 1.0, y0 + 0.15, Math.sin(i * 1.3) * 1.0]);
  } else {
    const r = 0.3 + tier * 0.07;
    orb = part('orb', [0, top + r * 1.6, 0], (m) => egg(m, r, [0, 0, 0], tier === 1 ? [0xb57cff, 0xffd24a, 0xff6fae] : RAINBOW.slice(0, 2 + tier)));
  }
  if (tier >= 3 || kind) {
    mb.cone(0.25, 0.5, kind === 'frost' ? 0x6fbfff : 0x6a4fa8, [0.65, y0 + h * 0.7, 0.45], [0.3, 0, -0.4], 6);
  }
  const crew: TowerRig['crew'] = [{ model: kind === 'frost' ? 'frost_chick' : 'mage_chick', pos: [0.55, top, 0.45] }];
  return { body: mb.build(), orb, crew, top };
}

// ───────────────────────── artillery line ─────────────────────────
function artillery(tier: number, kind?: 'bigegg' | 'tesla'): TowerRig {
  const mb = new MB();
  const y0 = plinth(mb, 1.3, 0.3);
  if (kind === 'tesla') {
    stoneTower(mb, 0.8, 0.55, y0, 2.4, 0x9a8a7a);
    for (let i = 0; i < 6; i++) mb.torus(0.55 - i * 0.03, 0.06, 0xd98a3a, [0, y0 + 2.5 + i * 0.18, 0], [Math.PI / 2, 0, 0]);
    mb.cyl(0.1, 0.25, 1.2, 0x6b6b78, [0, y0 + 2.9, 0], [0, 0, 0], 10);
    for (const a of [0, 2.1, 4.2]) mb.cyl(0.06, 0.06, 1.6, 0xd98a3a, [Math.cos(a) * 0.9, y0 + 0.8, Math.sin(a) * 0.9], [0, 0, 0], 6);
    const orb = part('orb', [0, y0 + 3.75, 0], (m) => {
      m.sphere(0.38, 0x9fe8ff, [0, 0, 0]);
      m.sphere(0.24, 0xffffff, [0, 0, 0]);
    }, { glow: true });
    return { body: mb.build(), orb, crew: [], top: y0 + 3.7 };
  }
  // wooden deck
  mb.cyl(1.1, 1.15, 0.25, WOOD_L, [0, y0 + 0.12, 0], [0, 0, 0], 14);
  // ammo pile
  for (let i = 0; i < 3; i++) egg(mb, 0.16, [0.75 + (i % 2) * 0.12, y0 + 0.45 + Math.floor(i / 2) * 0.2, -0.6 + i * 0.18], [0xfff6e6, 0xffd24a]);
  const big = kind === 'bigegg';
  const metal = tier === 3 || big ? GOLD : tier === 2 ? 0x7a7a88 : 0x5a5a68;
  const turret = part('turret', [0, y0 + 0.25, 0], (m) => {
    m.cyl(0.55, 0.65, 0.35, WOOD, [0, 0.18, 0], [0, 0, 0], 12);
    m.box(1.0, 0.5, 0.9, WOOD_D, [0, 0.55, -0.1], [0, 0, 0], 0.06);
    m.cyl(0.25, 0.25, 0.15, 0x3a3a3a, [0.55, 0.45, -0.1], [0, 0, Math.PI / 2], 12);
    m.cyl(0.25, 0.25, 0.15, 0x3a3a3a, [-0.55, 0.45, -0.1], [0, 0, Math.PI / 2], 12);
    if (big) {
      m.cyl(0.55, 0.7, 1.1, metal, [0, 1.15, 0.15], [0.55, 0, 0], 16);
      m.torus(0.6, 0.08, 0xd9473a, [0, 1.45, 0.35], [0.55 + Math.PI / 2, 0, 0]);
      egg(m, 0.42, [0, 1.75, 0.5], [0xfff6e6, 0xff6fae, 0xffd24a]);
    } else {
      const n = tier >= 2 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const x = n === 1 ? 0 : (k - 0.5) * 0.5;
        m.cyl(0.2 + tier * 0.03, 0.26 + tier * 0.03, 1.1, metal, [x, 0.9, 0.35], [1.15, 0, 0], 14);
        m.torus(0.22 + tier * 0.03, 0.05, tier === 3 ? 0xd9473a : GOLD, [x, 1.1, 0.8], [1.15 + Math.PI / 2, 0, 0]);
      }
      egg(m, 0.18, [0, 0.95, -0.35], [0xfff6e6, 0xffd24a, 0xff6fae]);
    }
  });
  return { body: mb.build(), turret, crew: [], top: y0 + 1.2 };
}

export const TOWER_MODELS: Record<string, (tier: number) => TowerRig> = {
  archer: (t) => archer(t),
  hawkeye: () => archer(4, 'hawkeye'),
  gatling: () => archer(4, 'gatling'),
  barracks: (t) => barracks(t),
  paladin: () => barracks(4, 'paladin'),
  berserker: () => barracks(4, 'berserker'),
  mage: (t) => mage(t),
  arcane: () => mage(4, 'arcane'),
  frost: () => mage(4, 'frost'),
  artillery: (t) => artillery(t),
  bigegg: () => artillery(4, 'bigegg'),
  tesla: () => artillery(4, 'tesla'),
};
