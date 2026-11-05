import type { EnemyId } from '../sim/types.ts';
import type { BattleScene } from './BattleScene.ts';

// 検証用のパネル。URL に ?debug=1 をつけると出る。` キーで表示を切り替える。

const ENEMY_IDS: EnemyId[] = ['blightling', 'gnasher', 'tuskbeast', 'wisp', 'rollereye', 'mireMaw'];

export function attachDebugPanel(scene: BattleScene): void {
  document.getElementById('debug-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.style.cssText =
    'position:fixed;top:8px;right:8px;z-index:10;background:rgba(20,18,30,.88);color:#fff;font:12px sans-serif;padding:8px;border-radius:8px;display:flex;flex-direction:column;gap:4px;max-width:220px';
  const row = () => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
    panel.appendChild(div);
    return div;
  };
  const btn = (parent: HTMLElement, text: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'font:12px sans-serif;padding:3px 6px;border-radius:4px;border:0;background:#3a4560;color:#fff;cursor:pointer';
    b.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    parent.appendChild(b);
  };
  const title = document.createElement('b');
  title.textContent = 'DEBUG (`)';
  panel.appendChild(title);
  const enemies = row();
  for (const id of ENEMY_IDS) btn(enemies, id, () => scene.world.command({ type: 'debugSpawnEnemy', enemy: id }));
  const res = row();
  btn(res, '+1000G', () => scene.world.command({ type: 'debugGold', amount: 1000 }));
  btn(res, '+200M', () => scene.world.command({ type: 'debugMana', amount: 200 }));
  btn(res, 'kill all', () => scene.world.command({ type: 'debugKillAll' }));
  let god = false;
  btn(res, 'god', () => {
    god = !god;
    scene.world.command({ type: 'debugGod', on: god });
  });
  const speed = row();
  for (const s of [1, 2, 4, 10]) btn(speed, `x${s}`, () => scene.setSpeed(s));
  const waves = row();
  for (let w = 1; w <= scene.world.totalWaves; w++) btn(waves, `W${w}`, () => scene.world.command({ type: 'debugJumpWave', wave: w }));
  document.body.appendChild(panel);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === '`') panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  };
  window.addEventListener('keydown', onKey);
  scene.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
}
