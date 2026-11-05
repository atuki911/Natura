import type { EnemyDef, EnemyId } from '../sim/types.ts';

// 敵。「穢れ(Blight)」から湧き出す生き物たち。

const base = {
  splash: 0,
  armor: 0,
  magic: false,
  hitsFlying: false,
  flying: false,
  critChance: 0,
  critMult: 1,
  knockback: 0,
  boss: false,
  special: null,
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  /** 基本の雑魚。ぷるぷる跳ねる紫の粘体。 */
  blightling: {
    ...base,
    id: 'blightling',
    hp: 60,
    damage: 8,
    range: 30,
    attackInterval: 1,
    windup: 0.25,
    speed: 38,
    attack: 'melee',
    bounty: 6,
  },
  /** 速くて脆い。歯だけが大きい小鬼。 */
  gnasher: {
    ...base,
    id: 'gnasher',
    hp: 42,
    damage: 6,
    range: 28,
    attackInterval: 0.55,
    windup: 0.12,
    speed: 82,
    attack: 'melee',
    bounty: 6,
  },
  /** 硬い。物理ダメージを大きく減らす。魔法が効く。 */
  tuskbeast: {
    ...base,
    id: 'tuskbeast',
    hp: 320,
    damage: 22,
    range: 40,
    attackInterval: 1.5,
    windup: 0.35,
    speed: 28,
    attack: 'melee',
    armor: 0.45,
    knockback: 30,
    bounty: 24,
  },
  /** 空を飛ぶ影。近接攻撃が届かない。 */
  wisp: {
    ...base,
    id: 'wisp',
    hp: 55,
    damage: 10,
    range: 170,
    attackInterval: 1.6,
    windup: 0.4,
    speed: 45,
    attack: 'spit',
    magic: true,
    flying: true,
    bounty: 10,
  },
  /** 転がる目玉。最初の一撃が重く、相手を吹き飛ばす。 */
  rollereye: {
    ...base,
    id: 'rollereye',
    hp: 150,
    damage: 14,
    range: 34,
    attackInterval: 1.1,
    windup: 0.1,
    speed: 72,
    attack: 'melee',
    bounty: 14,
    special: { type: 'charge', damageMult: 3, knockback: 90, slowAfter: 0.45 },
  },
  /** ボス。叩きつけで周りをまとめて攻撃し、雑魚を吐き出す。 */
  mireMaw: {
    ...base,
    id: 'mireMaw',
    hp: 5900,
    damage: 48,
    range: 80,
    attackInterval: 2.4,
    windup: 0.7,
    speed: 14,
    attack: 'slam',
    splash: 130,
    armor: 0.2,
    knockback: 70,
    bounty: 300,
    boss: true,
    special: { type: 'summon', enemy: 'blightling', count: 3, every: 9 },
  },
};
