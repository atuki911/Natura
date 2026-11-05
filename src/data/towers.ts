import type { AbilityDef, AbilityId, TowerDef, TowerId } from '../sim/types.ts';

export const TOWERS: Record<TowerId, TowerDef> = {
  /** 空にも地上にも届く。単体。 */
  arrowTower: {
    id: 'arrowTower',
    cost: { gold: 250, mana: 0 },
    range: 320,
    damage: 16,
    interval: 0.9,
    attack: 'arrow',
    splash: 0,
    hitsFlying: true,
    hitsGround: true,
  },
  /** 地上だけ。範囲ダメージ。 */
  cannonTower: {
    id: 'cannonTower',
    cost: { gold: 380, mana: 0 },
    range: 300,
    damage: 45,
    interval: 2.6,
    attack: 'cannon',
    splash: 80,
    hitsFlying: false,
    hitsGround: true,
  },
};

export const TOWER_ORDER: TowerId[] = ['arrowTower', 'cannonTower'];

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  heal: { id: 'heal', mana: 60, cooldown: 18, targeted: false },
  meteor: { id: 'meteor', mana: 90, cooldown: 22, targeted: true },
};

export const ABILITY_ORDER: AbilityId[] = ['heal', 'meteor'];

/** 能力の効き目。 */
export const HEAL_UNIT_RATIO = 0.5;
export const HEAL_CASTLE_RATIO = 0.08;
export const METEOR_DELAY = 0.7;
export const METEOR_RADIUS = 130;
export const METEOR_DAMAGE = 260;
