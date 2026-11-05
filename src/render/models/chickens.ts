import { MB, part, type RigDef, type RigPart, type Vec3 } from '../builder.ts';

export interface ChickenOpts {
  body: number;
  belly?: number;
  chick?: boolean;
  comb?: number;
  beak?: number;
  legs?: number;
  helmet?: 'cap' | 'knight' | 'gold' | 'horned' | 'wizard' | 'goggles' | 'bandana' | 'crown' | 'bigknight';
  helmetColor?: number;
  weapon?: 'spear' | 'sword' | 'flamesword' | 'axe' | 'bow' | 'staff' | 'bomb' | 'mace' | 'holysword' | 'stick';
  shield?: number;
  bigShield?: boolean;
  cape?: number;
  vest?: number;
  armor?: number;
  scarf?: number;
  size?: number;
  pack?: 'bombs' | 'quiver';
}

const S = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];

function weapon(mb: MB, w: ChickenOpts['weapon'], s: number) {
  // held at the wing tip: origin = shoulder joint, hand at about (0,-0.28,0.12)
  const h: Vec3 = S([0.02, -0.26, 0.14], s);
  switch (w) {
    case 'spear':
      mb.cyl(0.025 * s, 0.025 * s, 1.0 * s, 0x8a5a2b, [h[0], h[1] + 0.25 * s, h[2]], [0.25, 0, 0]);
      mb.cone(0.06 * s, 0.18 * s, 0xd8dde3, [h[0], h[1] + 0.82 * s, h[2] + 0.14 * s], [0.25, 0, 0]);
      break;
    case 'stick':
      mb.cyl(0.03 * s, 0.03 * s, 0.6 * s, 0xa0703a, [h[0], h[1] + 0.15 * s, h[2]], [0.4, 0, 0]);
      mb.sphere(0.06 * s, 0x6ab04c, [h[0], h[1] + 0.43 * s, h[2] + 0.12 * s]);
      break;
    case 'sword': case 'holysword': {
      const blade = w === 'holysword' ? 0xfff6c8 : 0xdfe6ee;
      mb.box(0.05 * s, 0.1 * s, 0.24 * s, 0x6b4a2b, [h[0], h[1], h[2] + 0.02 * s], [0, 0, 0]);
      mb.box(0.24 * s, 0.05 * s, 0.06 * s, w === 'holysword' ? 0xffcc33 : 0x9a7a3a, [h[0], h[1] + 0.06 * s, h[2]]);
      mb.box(0.07 * s, 0.62 * s, 0.035 * s, blade, [h[0], h[1] + 0.4 * s, h[2]], [0, 0, 0], 0.015 * s);
      break;
    }
    case 'flamesword':
      mb.box(0.25 * s, 0.05 * s, 0.07 * s, 0x5a3a20, [h[0], h[1] + 0.06 * s, h[2]]);
      mb.box(0.05 * s, 0.12 * s, 0.05 * s, 0x3a2a1a, [h[0], h[1] - 0.02 * s, h[2]]);
      mb.box(0.1 * s, 0.75 * s, 0.04 * s, 0xfff2c0, [h[0], h[1] + 0.47 * s, h[2]], [0, 0, 0], 0.02 * s);
      for (let k = 0; k < 4; k++) {
        const y = h[1] + (0.25 + k * 0.17) * s;
        mb.cone(0.07 * s, 0.22 * s, k % 2 ? 0xff7a1a : 0xffb21a, [h[0] + (k % 2 ? 0.06 : -0.06) * s, y, h[2]], [0, 0, k % 2 ? -0.5 : 0.5], 5);
      }
      mb.cone(0.06 * s, 0.25 * s, 0xff5a1a, [h[0], h[1] + 0.92 * s, h[2]], [0, 0, 0], 5);
      break;
    case 'axe':
      mb.cyl(0.03 * s, 0.03 * s, 0.7 * s, 0x7a4a22, [h[0], h[1] + 0.2 * s, h[2]]);
      mb.box(0.06 * s, 0.3 * s, 0.26 * s, 0xc8ced6, [h[0], h[1] + 0.48 * s, h[2] + 0.12 * s], [0, 0, 0], 0.03 * s);
      break;
    case 'mace':
      mb.cyl(0.03 * s, 0.03 * s, 0.5 * s, 0x6b4a2b, [h[0], h[1] + 0.12 * s, h[2]]);
      mb.ico(0.12 * s, 0x9aa3ad, [h[0], h[1] + 0.42 * s, h[2]], 0);
      break;
    case 'bow':
      mb.torus(0.32 * s, 0.025 * s, 0x8a5a2b, [h[0], h[1] + 0.1 * s, h[2] + 0.1 * s], [0, Math.PI / 2, 0], Math.PI * 0.9, [1, 1, 1]);
      break;
    case 'staff':
      mb.cyl(0.03 * s, 0.035 * s, 1.1 * s, 0x7a5230, [h[0], h[1] + 0.3 * s, h[2]]);
      mb.cone(0.12 * s, 0.22 * s, 0xffd94a, [h[0], h[1] + 0.95 * s, h[2]], [0, 0, 0], 5);
      mb.cone(0.12 * s, 0.22 * s, 0xffd94a, [h[0], h[1] + 0.95 * s, h[2]], [Math.PI, 0, 0], 5);
      break;
    case 'bomb':
      mb.sphere(0.2 * s, 0x2f2a3a, [h[0], h[1] + 0.05 * s, h[2] + 0.05 * s]);
      mb.sphere(0.06 * s, 0xffffff, [h[0] + 0.07 * s, h[1] + 0.13 * s, h[2] + 0.16 * s], [1, 1, 1], 6);
      mb.cyl(0.04 * s, 0.04 * s, 0.08 * s, 0x8a6a3a, [h[0], h[1] + 0.27 * s, h[2] + 0.05 * s]);
      break;
  }
}

export function chicken(o: ChickenOpts): RigDef {
  const s = o.size ?? 1;
  const beak = o.beak ?? 0xf6a21b;
  const legC = o.legs ?? 0xf08a24;
  const comb = o.comb ?? 0xe53935;
  const belly = o.belly ?? o.body;
  const mb = new MB();
  const hb = o.chick ? mb : new MB();
  let headY: number, headZ: number, headR: number;
  if (o.chick) {
    mb.sphere(0.4 * s, o.body, [0, 0.46 * s, 0], [1, 0.95, 1]);
    mb.sphere(0.3 * s, belly, [0, 0.4 * s, 0.13 * s], [1, 0.9, 0.8]);
    headY = 0.58 * s; headZ = 0.2 * s; headR = 0.3 * s;
    mb.eye(0.085 * s, [0.13 * s, 0.6 * s, 0.31 * s], [0.25, 0, 1]);
    mb.eye(0.085 * s, [-0.13 * s, 0.6 * s, 0.31 * s], [-0.25, 0, 1]);
    mb.cone(0.07 * s, 0.14 * s, beak, [0, 0.49 * s, 0.42 * s], [Math.PI / 2, 0, 0], 8);
    mb.cone(0.04 * s, 0.14 * s, o.body, [0.03 * s, 0.9 * s, 0], [0, 0, -0.4], 6);
    mb.cone(0.04 * s, 0.12 * s, o.body, [-0.04 * s, 0.88 * s, 0.02 * s], [0, 0, 0.5], 6);
    mb.sphere(0.06 * s, 0xff9aa2, [0.24 * s, 0.5 * s, 0.28 * s], [1, 0.6, 0.4], 8);
    mb.sphere(0.06 * s, 0xff9aa2, [-0.24 * s, 0.5 * s, 0.28 * s], [1, 0.6, 0.4], 8);
  } else {
    mb.sphere(0.36 * s, o.body, [0, 0.55 * s, -0.02 * s], [1, 0.95, 1.12]);
    mb.sphere(0.27 * s, belly, [0, 0.5 * s, 0.14 * s], [1, 1, 0.8]);
    // tail feathers
    for (let i = -1; i <= 1; i++) {
      mb.cone(0.09 * s, 0.38 * s, i === 0 ? o.body : 0x2b6e4a, [i * 0.09 * s, 0.82 * s, -0.36 * s], [-0.7, 0, i * 0.35], 6);
    }
    headY = 0.98 * s; headZ = 0.12 * s; headR = 0.24 * s;
    hb.sphere(headR, o.body, [0, headY, headZ]);
    hb.eye(0.07 * s, [0.1 * s, headY + 0.05 * s, headZ + 0.19 * s], [0.25, 0, 1]);
    hb.eye(0.07 * s, [-0.1 * s, headY + 0.05 * s, headZ + 0.19 * s], [-0.25, 0, 1]);
    hb.cone(0.075 * s, 0.17 * s, beak, [0, headY - 0.04 * s, headZ + 0.28 * s], [Math.PI / 2, 0, 0], 8);
    hb.sphere(0.055 * s, comb, [0, headY - 0.15 * s, headZ + 0.22 * s], [0.7, 1.3, 0.6], 8);
    hb.sphere(0.045 * s, 0xff9aa2, [0.17 * s, headY - 0.05 * s, headZ + 0.15 * s], [1, 0.6, 0.4], 6);
    hb.sphere(0.045 * s, 0xff9aa2, [-0.17 * s, headY - 0.05 * s, headZ + 0.15 * s], [1, 0.6, 0.4], 6);
    if (!o.helmet || o.helmet === 'bandana' || o.helmet === 'goggles') {
      hb.sphere(0.08 * s, comb, [0, headY + 0.24 * s, headZ + 0.08 * s]);
      hb.sphere(0.09 * s, comb, [0, headY + 0.27 * s, headZ - 0.03 * s]);
      hb.sphere(0.075 * s, comb, [0, headY + 0.23 * s, headZ - 0.13 * s]);
    }
  }
  // clothing
  if (o.vest != null) {
    mb.cyl(0.33 * s, 0.37 * s, 0.32 * s, o.vest, [0, 0.55 * s, 0], [0, 0, 0], 14, [1, 1, 1.12]);
  }
  if (o.armor != null) {
    mb.sphere(0.31 * s, o.armor, [0, 0.56 * s, 0.1 * s], [1.05, 0.9, 0.8]);
    mb.sphere(0.1 * s, o.armor, [0.3 * s, 0.72 * s, 0], [1, 0.8, 1]);
    mb.sphere(0.1 * s, o.armor, [-0.3 * s, 0.72 * s, 0], [1, 0.8, 1]);
  }
  if (o.scarf != null) {
    mb.torus(0.2 * s, 0.06 * s, o.scarf, [0, (o.chick ? 0.4 : 0.8) * s, 0.04 * s], [Math.PI / 2, 0, 0]);
    mb.box(0.1 * s, 0.3 * s, 0.04 * s, o.scarf, [0.12 * s, (o.chick ? 0.3 : 0.66) * s, -0.2 * s], [0.3, 0, 0.3]);
  }
  if (o.cape != null) {
    mb.box(0.55 * s, 0.6 * s, 0.05 * s, o.cape, [0, 0.55 * s, -0.36 * s], [0.18, 0, 0], 0.02);
  }
  if (o.pack === 'bombs') {
    mb.box(0.4 * s, 0.4 * s, 0.22 * s, 0x8a5a2b, [0, 0.62 * s, -0.36 * s], [0, 0, 0], 0.05 * s);
    mb.sphere(0.12 * s, 0x2f2a3a, [0.1 * s, 0.88 * s, -0.36 * s]);
    mb.sphere(0.12 * s, 0x2f2a3a, [-0.1 * s, 0.88 * s, -0.38 * s]);
  }
  if (o.pack === 'quiver') {
    mb.cyl(0.08 * s, 0.08 * s, 0.42 * s, 0x8a5a2b, [0.1 * s, 0.68 * s, -0.33 * s], [0.4, 0, -0.3]);
    mb.cone(0.03 * s, 0.1 * s, 0xffffff, [0.18 * s, 0.93 * s, -0.42 * s], [0.4, 0, -0.3], 4);
  }
  // headgear
  const hc = o.helmetColor ?? 0x9aa6b2;
  const hy = headY + headR * 0.45, hz = headZ - 0.02 * s;
  switch (o.helmet) {
    case 'cap':
      hb.hemi(headR * 1.08, hc, [0, hy - 0.02 * s, hz], [1, 0.75, 1]);
      hb.sphere(0.04 * s, 0xffffff, [0, hy + headR * 0.75, hz]);
      break;
    case 'knight': case 'gold': case 'bigknight':
      hb.hemi(headR * 1.12, hc, [0, hy - 0.06 * s, hz], [1, 1, 1]);
      hb.box(0.05 * s, 0.22 * s, 0.32 * s, o.helmet === 'gold' ? 0xffffff : 0xd94a3a, [0, hy + 0.2 * s, hz - 0.02 * s], [0, 0, 0], 0.02 * s);
      if (o.helmet === 'bigknight') {
        hb.cone(0.05 * s, 0.22 * s, 0xe8e0d0, [0.22 * s, hy + 0.12 * s, hz], [0, 0, -0.8], 6);
        hb.cone(0.05 * s, 0.22 * s, 0xe8e0d0, [-0.22 * s, hy + 0.12 * s, hz], [0, 0, 0.8], 6);
      }
      break;
    case 'horned':
      hb.torus(headR * 0.95, 0.05 * s, 0xc0392b, [0, hy - 0.02 * s, hz], [Math.PI / 2, 0, 0]);
      hb.box(0.08 * s, 0.25 * s, 0.04 * s, 0xc0392b, [0.06 * s, hy - 0.08 * s, hz - headR], [0.4, 0, 0.4]);
      break;
    case 'wizard':
      hb.cone(headR * 1.0, 0.6 * s, hc, [0, hy + 0.25 * s, hz - 0.03 * s], [-0.25, 0, 0.15], 14);
      hb.cyl(headR * 1.5, headR * 1.5, 0.04 * s, hc, [0, hy, hz], [0, 0, 0], 16);
      hb.sphere(0.06 * s, 0xffe66b, [0.05 * s, hy + 0.3 * s, hz + 0.12 * s]);
      break;
    case 'goggles':
      hb.torus(headR * 0.98, 0.04 * s, 0x5b3a22, [0, headY + 0.08 * s, headZ], [Math.PI / 2, 0, 0]);
      hb.cyl(0.07 * s, 0.07 * s, 0.06 * s, 0x9fd3ff, [0.09 * s, headY + 0.15 * s, headZ + 0.2 * s], [Math.PI / 2 - 0.4, 0, 0]);
      hb.cyl(0.07 * s, 0.07 * s, 0.06 * s, 0x9fd3ff, [-0.09 * s, headY + 0.15 * s, headZ + 0.2 * s], [Math.PI / 2 - 0.4, 0, 0]);
      break;
    case 'bandana':
      hb.torus(headR * 0.98, 0.05 * s, hc, [0, headY + 0.06 * s, headZ], [Math.PI / 2 + 0.15, 0, 0]);
      break;
    case 'crown':
      hb.cyl(headR * 0.7, headR * 0.75, 0.14 * s, 0xffcc33, [0, hy + 0.05 * s, hz]);
      break;
  }

  const legs = (side: number) => part(side > 0 ? 'legR' : 'legL', [side * 0.13 * s, (o.chick ? 0.14 : 0.3) * s, 0], (m) => {
    const L = (o.chick ? 0.14 : 0.28) * s;
    m.cyl(0.035 * s, 0.035 * s, L, legC, [0, -L / 2, 0]);
    m.box(0.05 * s, 0.03 * s, 0.16 * s, legC, [0, -L, 0.05 * s], [0, 0, 0], 0.012 * s);
    m.box(0.04 * s, 0.03 * s, 0.13 * s, legC, [0.05 * s, -L, 0.04 * s], [0, 0.5, 0], 0.012 * s);
    m.box(0.04 * s, 0.03 * s, 0.13 * s, legC, [-0.05 * s, -L, 0.04 * s], [0, -0.5, 0], 0.012 * s);
  });
  const wingY = (o.chick ? 0.5 : 0.65) * s;
  const wingX = (o.chick ? 0.36 : 0.33) * s;
  const wing = (side: number) => part(side > 0 ? 'wingR' : 'wingL', [side * wingX, wingY, 0.02 * s], (m) => {
    m.sphere(0.2 * s, o.body, [side * 0.04 * s, -0.1 * s, 0], [0.38, 0.85, 1.05]);
    m.cone(0.06 * s, 0.14 * s, o.body, [side * 0.05 * s, -0.27 * s, -0.08 * s], [0.4, 0, 0], 6);
    if (side > 0) weapon(m, o.weapon, s);
    if (side < 0 && o.shield != null) {
      const big = o.bigShield;
      const r = (big ? 0.42 : 0.24) * s;
      m.cyl(r, r, 0.07 * s, o.shield, [-0.1 * s, -0.12 * s, 0.12 * s], [0, 0, Math.PI / 2], 16, [1, big ? 1.25 : 1, 1]);
      m.cyl(r * 0.6, r * 0.6, 0.08 * s, big ? 0xffcc33 : 0xf5f0e0, [-0.12 * s, -0.12 * s, 0.12 * s], [0, 0, Math.PI / 2], 16);
      m.sphere(r * 0.25, 0xd0d6dd, [-0.16 * s, -0.12 * s, 0.12 * s]);
    }
    if (side < 0 && o.weapon === 'axe') weapon(m, 'axe', s);
  });
  const parts: RigPart[] = [legs(-1), legs(1), wing(-1), wing(1)];
  if (!o.chick) {
    // the head is its own joint so it can look around and peck
    const pv: Vec3 = [0, headY - headR * 0.75, headZ * 0.5];
    const hg = hb.build();
    hg.translate(-pv[0], -pv[1], -pv[2]);
    parts.push({ name: 'head', geo: hg, pivot: pv });
  }
  return {
    body: mb.build(),
    parts,
    height: (o.chick ? 1.0 : 1.35) * s,
  };
}

export const CHICKEN_MODELS: Record<string, () => RigDef> = {
  chick_soldier: () => chicken({ body: 0xffd84d, chick: true, helmet: 'cap', helmetColor: 0x6d8fb3, weapon: 'spear', size: 0.95 }),
  chick_reinf: () => chicken({ body: 0xffe36b, chick: true, weapon: 'stick', scarf: 0x4caf50, size: 0.9 }),
  hen_soldier: () => chicken({ body: 0xfaf3e6, belly: 0xffffff, helmet: 'knight', helmetColor: 0x9aa6b2, weapon: 'sword', shield: 0x3d6fb5, size: 0.85 }),
  rooster_knight: () => chicken({ body: 0xf6efe2, belly: 0xffffff, helmet: 'knight', helmetColor: 0x7e8a96, weapon: 'sword', shield: 0xb03a2e, armor: 0x8f9aa6, size: 0.92 }),
  paladin_soldier: () => chicken({ body: 0xffffff, helmet: 'gold', helmetColor: 0xffd24a, weapon: 'holysword', shield: 0xffffff, armor: 0xffd24a, cape: 0x3f6fd8, size: 0.98 }),
  berserker_soldier: () => chicken({ body: 0xb8582e, belly: 0xe0a070, helmet: 'horned', weapon: 'axe', vest: 0x5a3a22, size: 0.98 }),
  hero_kokka: () => chicken({ body: 0xfdf6ea, belly: 0xffffff, weapon: 'flamesword', vest: 0x2f5fa8, scarf: 0xe53935, size: 1.3 }),
  hero_bomba: () => chicken({ body: 0xc98a4b, belly: 0xf0c890, helmet: 'goggles', weapon: 'bomb', vest: 0x5b6b3a, pack: 'bombs', size: 1.25 }),
  hero_miko: () => chicken({ body: 0xffe066, chick: true, helmet: 'wizard', helmetColor: 0x7a4fd6, weapon: 'staff', cape: 0x5b3bb0, size: 1.35 }),
  hero_gardon: () => chicken({ body: 0xe8e2d6, belly: 0xffffff, helmet: 'bigknight', helmetColor: 0x5f7fa0, weapon: 'mace', shield: 0x4f7cac, bigShield: true, armor: 0x6f8aa6, size: 1.45 }),
  // tower crew
  archer_chick: () => chicken({ body: 0xffd84d, chick: true, helmet: 'bandana', helmetColor: 0x4caf50, weapon: 'bow', pack: 'quiver', size: 0.8 }),
  archer_hen: () => chicken({ body: 0xfaf3e6, helmet: 'bandana', helmetColor: 0x2e7d32, weapon: 'bow', pack: 'quiver', size: 0.72 }),
  ranger: () => chicken({ body: 0xf4ead8, helmet: 'cap', helmetColor: 0x2e5e3a, weapon: 'bow', cape: 0x2e5e3a, pack: 'quiver', size: 0.8 }),
  mage_chick: () => chicken({ body: 0xffe066, chick: true, helmet: 'wizard', helmetColor: 0x6a3fc8, weapon: 'staff', size: 0.75 }),
  frost_chick: () => chicken({ body: 0xe8f6ff, chick: true, helmet: 'wizard', helmetColor: 0x3f8fd8, weapon: 'staff', size: 0.75 }),
  gunner: () => chicken({ body: 0xc98a4b, helmet: 'goggles', size: 0.72 }),
  nest_hen: () => chicken({ body: 0xffffff, belly: 0xffffff, helmet: 'crown', size: 1.6 }),
};
