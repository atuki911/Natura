import type { Game, Tower, GEvent } from '../sim/game.ts';
import type { World, Pick } from '../render/world.ts';
import { TOWER, LINES, LINE_INFO, type TowerDef } from '../data/towers.ts';
import { ENEMY } from '../data/enemies.ts';
import { HERO_XP } from '../data/heroes.ts';
import { ICON } from './icons.ts';
import { rigPortrait, towerPortrait } from './portraits.ts';
import { audio } from '../audio/audio.ts';
import { Guide, rectTarget, type GuideTarget } from './guide.ts';
import { uiScale } from './scale.ts';
import { ITEMS, ITEM, type ItemId } from '../data/items.ts';

export interface HudHost {
  world: World;
  ui: HTMLElement;
  speed: number;
  guide: Guide;
  setPaused(p: boolean, reason: string): void;
  isPaused(): boolean;
  openPauseMenu(): void;
  markSeen(id: string): boolean;
  tutorial: boolean;
  finishTutorial(): void;
  lockedSpells: Set<string>;
  itemCount(id: ItemId): number;
  consumeItem(id: ItemId): void;
  tipSeen(id: string): boolean;
  openTip(id: string): void;
}

type Sel =
  | { kind: 'spot'; id: number }
  | { kind: 'tower'; id: number }
  | { kind: 'hero' }
  | { kind: 'enemy'; id: number }
  | null;

type Option = { key: string; dx: number; dy: number; html: string; cost?: number; onConfirm: () => boolean; info: () => string; range?: number; disabled?: boolean; instant?: boolean; maxed?: boolean };

type TutStep = '' | 'spot1' | 'pick1' | 'conf1' | 'wave' | 'w1' | 'spot2' | 'pick2' | 'conf2' | 'heroWait' | 'hero' | 'heroMove'
  | 'w2' | 'met' | 'metT' | 'w3' | 'up1' | 'up2' | 'up2c' | 'end';

const el = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const fmt = (n: number) => Math.round(n).toString();
const pct = (v: number) => Math.round(v * 100) + '%';
const small = () => false;

export class Hud {
  root: HTMLElement;
  private goldEl: HTMLElement;
  private livesEl: HTMLElement;
  private waveEl: HTMLElement;
  private speedBtn: HTMLButtonElement;
  private heroBtn: HTMLElement | null = null;
  private meteorBtn: HTMLElement;
  private reinfBtn: HTMLElement;
  private targetBar: HTMLElement;
  private radial: HTMLElement | null = null;
  private radialOpts: { opt: Option; el: HTMLElement }[] = [];
  private tooltip: HTMLElement;
  private infobar: HTMLElement;
  private waveBtns: HTMLElement[] = [];
  sel: Sel = null;
  private selOpt: string | null = null;
  private targeting: 'meteor' | 'reinforce' | 'rally' | 'bomb' | null = null;
  private itemBtns: { id: ItemId; el: HTMLElement }[] = [];
  private bagBtn!: HTMLElement;
  private tipCol: HTMLElement;
  private tipQueue = new Set<string>();
  private waveArmed = -1;
  private waveArmT = 0;
  private lastGold = -1;
  private lastLives = -1;
  private newQueue: string[] = [];
  private showingNew = false;
  private bossAnnounced = false;
  // tutorial
  private tut: TutStep = '';
  private tutT = 0;
  private tutSpots: number[] = [];
  private tutTower = -1;
  private tutCluster: { x: number; y: number } | null = null;

  constructor(private host: HudHost, private game: Game) {
    const ui = host.ui;
    this.root = el('div', 'hud passthru');
    this.root.style.cssText = 'position:absolute;inset:0;';
    ui.appendChild(this.root);

    const top = el('div', 'hud-stats outlined');
    this.livesEl = el('span', 'st', ICON.heart + '<b></b>');
    this.goldEl = el('span', 'st', ICON.coin + '<b></b>');
    this.waveEl = el('span', 'st wave', ICON.skull + '<b></b>');
    const row1 = el('div', 'st-row'); row1.append(this.livesEl, this.goldEl);
    const row2 = el('div', 'st-row'); row2.append(this.waveEl);
    top.append(row1, row2);
    this.root.appendChild(top);
    const right = el('div', 'hud-right');
    this.speedBtn = el('button', 'sqbtn outlined', '') as HTMLButtonElement;
    this.speedBtn.onclick = () => { audio.play('click'); this.host.speed = this.host.speed >= 3 ? 1 : this.host.speed + 1; this.refreshSpeed(); };
    const pause = el('button', 'sqbtn', ICON.pause);
    pause.onclick = () => { audio.play('click'); this.host.openPauseMenu(); };
    right.append(this.speedBtn, pause);
    this.root.appendChild(right);
    this.refreshSpeed();

    const bottom = el('div', 'hud-bottom');
    this.meteorBtn = el('div', 'spell meteor', `<div class="spell-face">${ICON.meteorArt}</div><div class="shine"></div><div class="cd"></div><div class="cdtext outlined"></div><div class="lockface">${ICON.lock}</div><div class="spell-name outlined">卵メテオ</div>`);
    this.meteorBtn.onclick = () => this.toggleTargeting('meteor');
    this.reinfBtn = el('div', 'spell reinf', `<div class="spell-face">${ICON.chickArt}</div><div class="shine"></div><div class="cd"></div><div class="cdtext outlined"></div><div class="lockface">${ICON.lock}</div><div class="spell-name outlined">援軍</div>`);
    this.reinfBtn.onclick = () => this.toggleTargeting('reinforce');
    bottom.append(this.meteorBtn, this.reinfBtn);
    this.root.appendChild(bottom);
    const br = el('div', 'hud-bottom-right');
    const items = el('div', 'itembar');
    const art: Record<ItemId, string> = { bomb: ICON.itemBomb, frost: ICON.itemFrost, goldsack: ICON.itemGold, heart: ICON.itemHeart, thunder: ICON.itemThunder };
    for (const it of ITEMS) {
      const b = el('div', 'itembtn', `${art[it.id]}<span class="icount outlined"></span><span class="iname outlined">${it.name}</span>`);
      b.title = it.name + ': ' + it.desc;
      b.onclick = () => this.onItem(it.id);
      items.appendChild(b);
      this.itemBtns.push({ id: it.id, el: b });
    }
    const bag = el('div', 'spell bag', `<div class="spell-face">${ICON.bag}</div><span class="bagcount outlined"></span><div class="spell-name outlined">道具</div>`);
    bag.onclick = () => { audio.play('click'); items.classList.toggle('open'); };
    this.bagBtn = bag;
    br.append(items, bag);
    this.root.appendChild(br);
    if (game.hero) {
      const h = game.hero;
      this.heroBtn = el('div', 'spell hero', `<div class="spell-face"><img src="${rigPortrait(h.model)}"></div><div class="cd"></div><div class="cdtext outlined"></div><div class="lvbadge outlined"></div><div class="herohp"><i></i></div>`);
      this.heroBtn.onclick = () => this.onHeroButton();
      this.root.appendChild(this.heroBtn);
    }
    this.tipCol = el('div', 'tipcol');
    this.root.appendChild(this.tipCol);
    this.refreshItems();

    this.targetBar = el('div', 'targetbar outlined', `<span></span><button class="btn small red">${ICON.close.replace('<svg', '<svg width="18" height="18"')} やめる</button>`);
    this.targetBar.style.display = 'none';
    (this.targetBar.querySelector('button') as HTMLElement).onclick = () => { audio.play('click'); this.cancelTargeting(); };
    this.root.appendChild(this.targetBar);

    this.tooltip = el('div', 'tooltip panel');
    this.tooltip.style.display = 'none';
    this.root.appendChild(this.tooltip);
    this.infobar = el('div', 'infobar woodpanel outlined');
    this.infobar.style.display = 'none';
    this.root.appendChild(this.infobar);

    host.world.onTap = (p) => this.onTap(p);
    host.world.onHover = () => {};
    if (host.tutorial) this.startTutorial();
  }

  destroy() {
    this.root.remove();
    this.host.guide.hide();
    this.host.world.hideRange();
    this.host.world.hideRally();
    this.host.world.showTargetMarker(null);
    this.host.world.heroSelected = false;
  }

  private refreshSpeed() { this.speedBtn.innerHTML = `<span>x${this.host.speed}</span>`; }

  // ───────────────────────── input ─────────────────────────
  private onHeroButton() {
    const g = this.game;
    if (!g.hero) return;
    if (this.tut && this.tut !== 'hero' && !this.tutFree()) { audio.play('deny'); return; }
    audio.play('cluck');
    this.cancelTargeting();
    this.select(this.sel?.kind === 'hero' ? null : { kind: 'hero' });
    if (this.tut === 'hero' && this.sel?.kind === 'hero') this.tut = 'heroMove';
  }

  private toggleTargeting(t: 'meteor' | 'reinforce') {
    const g = this.game;
    if (this.tut && !(this.tut === 'met' && t === 'meteor') && !this.tutFree()) { audio.play('deny'); return; }
    if (this.host.lockedSpells.has(t)) { audio.play('deny'); this.float(window.innerWidth / 2, window.innerHeight / 2, 'まだ使えない!', 'life'); return; }
    const cd = t === 'meteor' ? g.meteorCd : g.reinforceCd;
    if (cd > 0) { audio.play('deny'); return; }
    audio.play('click');
    this.closeRadial();
    this.sel = null;
    this.host.world.heroSelected = false;
    this.targeting = this.targeting === t ? null : t;
    if (this.tut === 'met' && this.targeting === 'meteor') this.tut = 'metT';
    this.refreshTargetBar();
  }

  private cancelTargeting() {
    if (this.tut === 'metT') return;
    this.targeting = null;
    this.host.world.showTargetMarker(null);
    this.refreshTargetBar();
    if (this.sel?.kind === 'tower') this.select({ kind: 'tower', id: this.sel.id });
  }

  private refreshTargetBar() {
    const t = this.targeting;
    if (!t) { this.targetBar.style.display = 'none'; return; }
    this.targetBar.style.display = 'flex';
    (this.targetBar.querySelector('span') as HTMLElement).textContent =
      t === 'meteor' ? '卵メテオを落とす場所をタップ' : t === 'reinforce' ? '援軍を呼ぶ場所をタップ' : t === 'bomb' ? 'たまご爆弾を落とす場所をタップ' : '兵士の集合場所をタップ';
  }

  /** during free-play tutorial phases every action is allowed */
  private tutFree() { return this.tut === '' || this.tut === 'w1' || this.tut === 'w2' || this.tut === 'w3' || this.tut === 'heroWait'; }

  onTap(p: Pick) {
    const g = this.game;
    const w = this.host.world;
    if (this.showingNew) return;
    // tutorial: while moving the hero, any tap on the island counts as the destination
    if (this.tut === 'heroMove' && p.inside && p.kind !== 'none') {
      g.moveHero(p);
      w.burst('dust', p.x, 0.2, p.y, 6);
      w.showMoveMarker(p.x, p.y);
      this.select(null);
      this.tut = 'w2'; this.tutT = 0; this.host.setPaused(false, 'tut');
      return;
    }
    // tutorial gating
    if (this.tut && !this.tutFree()) {
      const ok =
        (this.tut === 'spot1' && p.kind === 'spot' && p.id === this.tutSpots[0]) ||
        (this.tut === 'spot2' && p.kind === 'spot' && p.id === this.tutSpots[1]) ||
        (this.tut === 'hero' && p.kind === 'hero') ||
        (this.tut === 'heroMove' && p.kind !== 'none' && p.kind !== 'tower' && p.kind !== 'hero' && p.inside) ||
        (this.tut === 'metT' && p.kind !== 'none' && p.inside) ||
        (this.tut === 'up1' && p.kind === 'tower' && p.id === this.tutTower);
      if (!ok) { audio.play('deny'); return; }
    }
    if (this.targeting === 'bomb') {
      if (p.kind !== 'none' && p.inside && g.useItem('bomb', p)) { this.host.consumeItem('bomb'); this.refreshItems(); this.targeting = null; this.refreshTargetBar(); return; }
      audio.play('deny');
      return;
    }
    if (this.targeting === 'meteor' || this.targeting === 'reinforce') {
      if (p.kind !== 'none' && p.inside) {
        const ok = this.targeting === 'meteor' ? g.castMeteor(p) : g.castReinforce(p);
        if (ok) {
          this.targeting = null;
          this.refreshTargetBar();
          if (this.tut === 'metT') { this.tut = 'w3'; this.tutT = 0; this.host.setPaused(false, 'tut'); }
          return;
        }
      }
      audio.play('deny');
      return;
    }
    if (this.targeting === 'rally' && this.sel?.kind === 'tower') {
      const t = g.towers.find((x) => x.id === (this.sel as { id: number }).id);
      if (t && g.setRally(t, p)) { this.targeting = null; this.refreshTargetBar(); this.select(null); return; }
      audio.play('deny');
      return;
    }
    if (this.sel?.kind === 'hero' && p.kind !== 'hero' && p.kind !== 'tower' && p.kind !== 'none') {
      if (p.inside) {
        g.moveHero(p);
        w.burst('dust', p.x, 0.2, p.y, 6);
        w.showMoveMarker(p.x, p.y);
        if (this.tut === 'heroMove') { this.tut = 'w2'; this.tutT = 0; this.host.setPaused(false, 'tut'); }
      }
      this.select(null);
      return;
    }
    switch (p.kind) {
      case 'spot': audio.play('click'); this.select({ kind: 'spot', id: p.id }); break;
      case 'tower': audio.play('click'); this.select(this.sel?.kind === 'tower' && this.sel.id === p.id ? null : { kind: 'tower', id: p.id }); break;
      case 'hero': audio.play('cluck'); this.select(this.sel?.kind === 'hero' ? null : { kind: 'hero' }); if (this.tut === 'hero' && this.sel?.kind === 'hero') this.tut = 'heroMove'; break;
      case 'enemy': this.select({ kind: 'enemy', id: p.id }); break;
      default: this.select(null);
    }
    if (this.tut === 'spot1' && this.sel?.kind === 'spot') this.tut = 'pick1';
    if (this.tut === 'spot2' && this.sel?.kind === 'spot') this.tut = 'pick2';
    if (this.tut === 'up1' && this.sel?.kind === 'tower') this.tut = 'up2';
  }

  private select(s: Sel) {
    this.sel = s;
    this.selOpt = null;
    this.closeRadial();
    const w = this.host.world;
    w.hideRange();
    w.hideRally();
    w.heroSelected = s?.kind === 'hero';
    if (!s) return;
    if (s.kind === 'spot') this.openBuild(s.id);
    if (s.kind === 'tower') this.openTower(s.id);
    if (s.kind === 'hero' && this.game.hero) {
      this.targetBar.style.display = 'flex';
      (this.targetBar.querySelector('span') as HTMLElement).textContent = 'ヒーローの移動先をタップ';
    }
  }

  // ───────────────────────── items, unlocks, tips ─────────────────────────
  private onItem(id: ItemId) {
    if (this.tut && !this.tutFree()) { audio.play('deny'); return; }
    const g = this.game;
    if (this.host.itemCount(id) <= 0) {
      audio.play('deny');
      const b = this.itemBtns.find((x) => x.id === id)!.el.getBoundingClientRect();
      this.float(b.left + b.width / 2, b.top - 10, 'ショップで買えるよ', 'gold');
      return;
    }
    this.closeRadial();
    this.sel = null;
    if (ITEM[id].target) { audio.play('click'); this.targeting = this.targeting === 'bomb' ? null : 'bomb'; this.refreshTargetBar(); return; }
    this.itemBtns[0].el.parentElement?.classList.remove('open');
    if (g.useItem(id)) {
      this.host.consumeItem(id);
      this.refreshItems();
      const b = this.itemBtns.find((x) => x.id === id)!.el.getBoundingClientRect();
      this.float(b.left + b.width / 2, b.top - 10, ITEM[id].name + '!', 'bonus');
      if (id === 'goldsack') this.flashGold();
    } else audio.play('deny');
  }

  private refreshItems() {
    let total = 0;
    for (const { id } of this.itemBtns) total += this.host.itemCount(id);
    if (this.bagBtn) (this.bagBtn.querySelector('.bagcount') as HTMLElement).textContent = String(total);
    for (const { id, el: e } of this.itemBtns) {
      const n = this.host.itemCount(id);
      (e.querySelector('.icount') as HTMLElement).textContent = String(n);
      e.classList.toggle('empty', n <= 0);
      e.classList.toggle('active', this.targeting === 'bomb' && id === 'bomb');
    }
  }

  /** spells unlock one by one during the very first stage */
  private updateUnlocks() {
    const L = this.host.lockedSpells;
    const g = this.game;
    const unlock = (k: string, b: HTMLElement) => {
      L.delete(k);
      b.classList.remove('locked');
      const bub = el('div', 'powerbubble outlined', '新しいパワー!');
      b.appendChild(bub);
      setTimeout(() => bub.remove(), 4200);
      audio.play('levelup');
    };
    if (L.has('meteor') && g.waveIdx >= 1) unlock('meteor', this.meteorBtn);
    if (L.has('reinforce') && g.waveIdx >= 3) unlock('reinforce', this.reinfBtn);
    this.meteorBtn.classList.toggle('locked', L.has('meteor'));
    this.reinfBtn.classList.toggle('locked', L.has('reinforce'));
  }

  /** "!" hint buttons on the left the first time something new happens */
  queueTip(id: string) {
    if (this.host.tipSeen(id) || this.tipQueue.has(id)) return;
    this.tipQueue.add(id);
    const b = el('div', 'tipbtn', ICON.tip);
    b.onclick = () => { audio.play('click'); b.remove(); this.tipQueue.delete(id); this.host.openTip(id); };
    this.tipCol.appendChild(b);
  }

  // ───────────────────────── radial menus ─────────────────────────
  private closeRadial() {
    this.radial?.remove();
    this.radial = null;
    this.radialOpts = [];
    this.tooltip.style.display = 'none';
    if (!this.targeting) this.targetBar.style.display = 'none';
  }

  private makeRadial(opts: Option[]) {
    this.closeRadial();
    const r = el('div', 'radial');
    r.appendChild(el('div', 'ring'));
    const k = uiScale();
    for (const o of opts) {
      const b = el('div', 'ropt' + (o.disabled ? ' lockline' : '') + (o.maxed ? ' maxed' : ''), o.html + `<div class="confirm">${ICON.check}</div>`);
      b.dataset.key = o.key;
      b.style.left = o.dx * k + 'px';
      b.style.top = o.dy * k + 'px';
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); this.clickOption(o); });
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.showOptInfo(o); });
      b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && this.selOpt !== o.key) this.tooltip.style.display = 'none'; });
      r.appendChild(b);
      this.radialOpts.push({ opt: o, el: b });
    }
    this.root.appendChild(r);
    this.radial = r;
    this.positionRadial();
    this.refreshAffordability();
  }

  private tutAllowsOption(key: string): boolean {
    switch (this.tut) {
      case 'pick1': case 'conf1': return key === 'archer';
      case 'pick2': case 'conf2': return key === 'barracks';
      case 'up2': case 'up2c': return key === 'up';
      case '': case 'w1': case 'w2': case 'w3': case 'heroWait': return true;
      default: return false;
    }
  }

  private clickOption(o: Option) {
    if (!this.tutAllowsOption(o.key)) { audio.play('deny'); return; }
    if (o.disabled) { audio.play('deny'); this.showOptInfo(o); return; }
    if (o.instant || this.selOpt === o.key) {
      if (o.cost != null && this.game.gold < o.cost) { audio.play('deny'); this.flashGold(); return; }
      const ok = o.onConfirm();
      if (!ok) { audio.play('deny'); return; }
      return;
    }
    audio.play('click');
    this.selOpt = o.key;
    for (const x of this.radialOpts) x.el.classList.toggle('sel', x.opt.key === o.key);
    this.showOptInfo(o);
    const s = this.sel;
    if (o.range && s && (s.kind === 'spot' || s.kind === 'tower')) {
      const p = s.kind === 'spot' ? this.game.spots[s.id] : this.game.towers.find((t) => t.id === s.id)!;
      this.host.world.showRange(p.x, p.y, o.range, 0x9dff7a);
    }
    if (this.tut === 'pick1') this.tut = 'conf1';
    if (this.tut === 'pick2') this.tut = 'conf2';
    if (this.tut === 'up2') this.tut = 'up2c';
  }

  /** info card beside the ring (never on top of the buttons, and it never takes taps) */
  private showOptInfo(o: Option) {
    const confirmHint = !o.instant && !o.disabled ? `<div class="tip-confirm">${this.selOpt === o.key ? 'もう一度タップで決定!' : 'タップで選択 → もう一度で決定'}</div>` : '';
    this.tooltip.innerHTML = o.info() + confirmHint;
    this.tooltip.style.display = 'block';
    const tw = Math.min(340 * uiScale(), window.innerWidth - 24);
    this.tooltip.style.width = tw + 'px';
    const rr = this.radial?.getBoundingClientRect();
    const cx = rr ? rr.left : window.innerWidth / 2, cy = rr ? rr.top : window.innerHeight / 2;
    const reach = 165 * uiScale();
    const th = this.tooltip.offsetHeight;
    let x: number, y: number;
    const roomR = window.innerWidth - (cx + reach), roomL = cx - reach;
    if (roomR >= tw + 12 || roomL >= tw + 12) {
      x = roomR >= roomL ? cx + reach : cx - reach - tw;
      y = cy - th / 2;
    } else {
      x = (window.innerWidth - tw) / 2;
      y = cy - reach - th - 6 > 8 ? cy - reach - th - 6 : cy + reach + 6;
    }
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    y = Math.max(60, Math.min(window.innerHeight - th - 8, y));
    this.tooltip.style.left = x + 'px';
    this.tooltip.style.top = y + 'px';
  }

  private towerInfo(def: TowerDef, cost?: number): string {
    const g = this.game;
    const s = def.soldiers;
    const dmgType = def.dmgType === 'magic' ? '魔法' : def.dmgType === 'explosive' ? '爆発' : '物理';
    let stats = '';
    if (s) stats = `<b>兵士</b><span>${s.name} x${s.count}</span><b>体力</b><span>${s.hp}</span><b>攻撃</b><span>${s.dmg[0]}-${s.dmg[1]}</span><b>防御</b><span>${pct(s.armor)}</span>`;
    else stats = `<b>攻撃</b><span>${def.dmg[0]}-${def.dmg[1]} (${dmgType})</span><b>速度</b><span>${def.rate <= 0.3 ? 'とても速い' : def.rate <= 0.7 ? '速い' : def.rate <= 1.6 ? '普通' : '遅い'}</span><b>射程</b><span>${def.range.toFixed(1)}</span>${def.aoe ? `<b>範囲</b><span>${def.aoe}</span>` : ''}<b>対空</b><span>${def.hitsFlying ? 'できる' : 'できない'}</span>`;
    return `<h4>${def.name}</h4>${def.desc}<div class="stats">${stats}${cost != null ? `<b>費用</b><span>${cost} G${g.gold < cost ? ' <span style="color:#c0392b">(金貨不足)</span>' : ''}</span>` : ''}</div>`;
  }

  private openBuild(spotId: number) {
    const g = this.game;
    const corners = [[-88, -88], [88, -88], [-88, 88], [88, 88]];
    const opts: Option[] = LINES.map((line, i) => {
      const def = TOWER[LINE_INFO[line].base];
      const cost = g.towerCost(def);
      const allowed = g.allowedLine(line);
      return {
        key: line, dx: corners[i][0], dy: corners[i][1], cost, range: def.range,
        disabled: !allowed,
        html: `<img src="${towerPortrait(def.model, 1)}"><div class="olabel outlined">${LINE_INFO[line].name}</div><div class="cost">${allowed ? cost : '×'}</div>`,
        info: () => allowed ? this.towerInfo(def, cost) : `<h4>${def.name}</h4>このモードでは建てられません。`,
        onConfirm: () => {
          const ok = g.build(spotId, def.id);
          if (ok) {
            this.select(null);
            this.queueTip(line);
            if (this.tut === 'conf1') { this.tut = 'wave'; this.tutTower = g.towers[g.towers.length - 1].id; }
            if (this.tut === 'conf2') { this.tut = 'heroWait'; this.tutT = 0; this.host.setPaused(false, 'tut'); }
          }
          return ok;
        },
      };
    });
    this.makeRadial(opts);
  }

  private openTower(id: number) {
    const g = this.game;
    const t = g.towers.find((x) => x.id === id);
    if (!t) return;
    const w = this.host.world;
    w.showRange(t.x, t.y, g.range(t), t.def.soldiers ? 0x7ac8ff : 0xffffff);
    if (t.def.soldiers) w.showRally(t.rally.x, t.rally.y);
    const opts: Option[] = [];
    const next = t.def.next;
    if (next.length === 1) {
      const def = TOWER[next[0]];
      const cost = g.towerCost(def);
      opts.push({ key: 'up', dx: 0, dy: -118, cost, range: def.range, html: `<div class="obg up"></div>${ICON.up}<div class="olabel outlined">強化</div><div class="cost">${cost}</div>`, info: () => this.towerInfo(def, cost), onConfirm: () => this.afterAction(g.upgrade(t, def.id), t) });
    } else if (next.length === 2) {
      next.forEach((nid, i) => {
        const def = TOWER[nid];
        const cost = g.towerCost(def);
        opts.push({ key: 'br' + i, dx: i ? 92 : -92, dy: -92, cost, range: def.range, html: `<img src="${towerPortrait(def.model, 4)}"><div class="cost">${cost}</div>`, info: () => this.towerInfo(def, cost), onConfirm: () => this.afterAction(g.upgrade(t, def.id), t) });
      });
    } else if (t.def.abilities) {
      t.def.abilities.forEach((ab, i) => {
        const lv = t.abil[ab.id] ?? 0;
        const cost = g.abilityCost(t, ab.id);
        const pips = ab.costs.map((_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
        opts.push({
          key: 'ab' + i, dx: i ? 92 : -92, dy: -92, cost: cost ?? undefined, maxed: cost == null,
          html: `<div class="obg ${i ? 'ab2' : 'ab1'}"></div>${i ? ICON.magic : ICON.sword}<div class="pips">${pips}</div><div class="cost">${cost == null ? 'MAX' : cost}</div>`,
          info: () => `<h4>${ab.name} Lv${lv}${cost != null ? ' → ' + (lv + 1) : ''}</h4>${ab.desc}<div class="stats"><b>効果</b><span>${ab.values.map((v, k) => (k === lv ? `<u>${fmtVal(v)}</u>` : fmtVal(v))).join(' / ')}</span>${cost != null ? `<b>費用</b><span>${cost} G</span>` : '<b>状態</b><span>最大レベル</span>'}</div>`,
          onConfirm: () => {
            if (cost == null) return false;
            const ok = g.buyAbility(t, ab.id);
            if (ok) this.select({ kind: 'tower', id: t.id });
            return ok;
          },
        });
      });
    }
    const sv = g.sellValue(t);
    opts.push({ key: 'sell', dx: 0, dy: 120, html: `<div class="obg sell"></div>${ICON.sell}<div class="cost">+${sv}</div>`, info: () => `<h4>売却</h4>このタワーを売って ${sv} G を受け取ります。`, onConfirm: () => { g.sell(t); this.select(null); return true; } });
    if (t.def.soldiers) {
      opts.push({ key: 'rally', dx: 110, dy: 50, instant: true, html: `<div class="obg rally"></div>${ICON.flag}`, info: () => `<h4>集合地点</h4>兵士の集合場所を変更します。`, onConfirm: () => {
        this.closeRadial();
        this.targeting = 'rally';
        this.refreshTargetBar();
        w.showRange(t.x, t.y, g.range(t), 0x7ac8ff);
        return true;
      } });
    }
    this.makeRadial(opts);
    this.updateInfoTower(t);
  }

  private afterAction(ok: boolean, t: Tower): boolean {
    if (ok) {
      if (this.tut === 'up2c') { this.tut = 'end'; this.tutT = 0; this.host.setPaused(false, 'tut'); this.select(null); return true; }
      this.select({ kind: 'tower', id: t.id });
    }
    return ok;
  }

  private positionRadial() {
    if (!this.radial || !this.sel) return;
    const g = this.game;
    let x = 0, y = 0, h = 0.6;
    if (this.sel.kind === 'spot') { const s = g.spots[this.sel.id]; x = s.x; y = s.y; }
    else if (this.sel.kind === 'tower') {
      const t = g.towers.find((q) => q.id === (this.sel as { id: number }).id);
      if (!t) { this.select(null); return; }
      x = t.x; y = t.y; h = 1.6;
    }
    const p = this.host.world.project(x, h, y);
    const S = uiScale();
    // keep the whole ring on screen and clear of the corner buttons
    const px = Math.max(160 * S, Math.min(window.innerWidth - 160 * S, p.x));
    const py = Math.max(200 * S, Math.min(window.innerHeight - 170 * S, p.y));
    this.radial.style.left = px + 'px';
    this.radial.style.top = py + 'px';
  }

  // ───────────────────────── per-frame ─────────────────────────
  update(events: GEvent[], dt: number) {
    const g = this.game;
    for (const ev of events) this.onEvent(ev);
    if (g.gold !== this.lastGold) { (this.goldEl.lastChild as HTMLElement).textContent = fmt(g.gold); this.lastGold = g.gold; this.refreshAffordability(); }
    if (g.lives !== this.lastLives) {
      (this.livesEl.lastChild as HTMLElement).textContent = String(Math.max(0, g.lives));
      if (this.lastLives > 0 && g.lives < this.lastLives) { this.livesEl.classList.remove('flash'); void this.livesEl.offsetWidth; this.livesEl.classList.add('flash'); }
      this.lastLives = g.lives;
    }
    (this.waveEl.lastChild as HTMLElement).textContent = `敵部隊 ${Math.max(0, g.waveIdx + 1)}/${g.waves.length}`;
    this.cdButton(this.meteorBtn, g.meteorCd, g.spellMeteorMax, this.targeting === 'meteor');
    this.cdButton(this.reinfBtn, g.reinforceCd, g.spellReinforceMax, this.targeting === 'reinforce');
    const h = g.hero;
    if (h && this.heroBtn) {
      (this.heroBtn.querySelector('.herohp i') as HTMLElement).style.width = pct(h.dead ? 0 : h.hp / h.maxHp);
      const cd = this.heroBtn.querySelector('.cd') as HTMLElement;
      cd.style.background = h.dead ? `conic-gradient(rgba(20,10,4,.7) ${(h.respawnT / 15) * 360}deg, rgba(20,10,4,.35) 0)` : 'none';
      (this.heroBtn.querySelector('.cdtext') as HTMLElement).textContent = h.dead ? Math.ceil(h.respawnT) + '' : '';
      (this.heroBtn.querySelector('.lvbadge') as HTMLElement).textContent = String(h.level);
      this.heroBtn.classList.toggle('active', this.sel?.kind === 'hero');
      this.heroBtn.classList.toggle('cooling', h.dead);
    }
    this.updateUnlocks();
    if (this.waveArmT > 0) { this.waveArmT -= dt; if (this.waveArmT <= 0) this.waveArmed = -1; }
    this.positionRadial();
    this.updateWaveButtons();
    this.updateInfo();
    this.updateTutorial(dt);
  }

  private cdButton(b: HTMLElement, cd: number, max: number, active: boolean) {
    const cdEl = b.querySelector('.cd') as HTMLElement;
    const t = b.querySelector('.cdtext') as HTMLElement;
    const f = cd > 0 ? cd / max : 0;
    cdEl.style.background = f > 0 ? `conic-gradient(rgba(20,10,4,.68) ${f * 360}deg, transparent 0)` : 'none';
    t.textContent = cd > 0 ? Math.ceil(cd) + '' : '';
    b.classList.toggle('active', active);
    b.classList.toggle('cooling', cd > 0);
    b.classList.toggle('ready', cd <= 0 && !active);
  }

  private refreshAffordability() {
    for (const { opt, el: e } of this.radialOpts) {
      if (opt.cost == null || opt.disabled) continue;
      e.classList.toggle('poor', this.game.gold < opt.cost);
    }
  }

  private flashGold() {
    this.goldEl.classList.remove('flash'); void this.goldEl.offsetWidth; this.goldEl.classList.add('flash');
  }

  // ───────────────────────── wave call buttons ─────────────────────────
  private updateWaveButtons() {
    const g = this.game;
    const gateTut = this.tut !== '' && !this.tutFree() && this.tut !== 'wave';
    const show = g.nextWaveReady() && !this.showingNew && !gateTut;
    const preview = show ? g.nextWavePreview() : [];
    const starts: { x: number; y: number; dx: number; dy: number; paths: number[] }[] = [];
    if (show) {
      for (const pr of preview) {
        const p = g.paths[Math.min(pr.path, g.paths.length - 1)].at(0.5);
        let s = starts.find((q) => Math.hypot(q.x - p.x, q.y - p.y) < 2);
        if (!s) { s = { x: p.x, y: p.y, dx: p.dx, dy: p.dy, paths: [] }; starts.push(s); }
        if (!s.paths.includes(pr.path)) s.paths.push(pr.path);
      }
    }
    while (this.waveBtns.length > starts.length) this.waveBtns.pop()!.remove();
    starts.forEach((s, i) => {
      let b = this.waveBtns[i];
      if (!b) {
        b = el('div', 'wavebtn', ICON.skull + '<div class="ring"></div><div class="wavepreview"></div><div class="wavehint outlined">もう一度タップで呼ぶ</div>');
        let touch = false;
        b.addEventListener('pointerdown', (e) => { touch = e.pointerType !== 'mouse'; });
        const idx = i;
        b.onclick = () => {
          // on touch screens the first tap shows what is coming, the second calls it (avoids accidental calls)
          if (touch && this.waveArmed !== idx) { this.waveArmed = idx; this.waveArmT = 3; audio.play('click'); return; }
          this.waveArmed = -1;
          const bonus = g.callWave();
          if (g.waveIdx === 0) this.queueTip('early');
          audio.play('horn');
          if (bonus > 0) this.float(b.getBoundingClientRect().left + 32, b.getBoundingClientRect().top, `+${bonus}`, 'bonus');
          if (this.tut === 'wave') { this.tut = 'w1'; this.tutT = 0; }
        };
        this.root.appendChild(b);
        this.waveBtns[i] = b;
      }
      b.classList.toggle('first', g.waveIdx === -1);
      b.classList.toggle('armed', this.waveArmed === i);
      const p = this.host.world.project(s.x + s.dx * 3, 0.5, s.y + s.dy * 3);
      const S = uiScale();
      const m = 50 * S;
      const x = Math.max(m, Math.min(window.innerWidth - m - 160 * S, p.x));
      const y = Math.max(220 * S, Math.min(window.innerHeight - 230 * S, p.y));
      b.style.left = x + 'px';
      b.style.top = y + 'px';
      const ring = b.querySelector('.ring') as HTMLElement;
      if (g.waveIdx >= 0 && g.waveCountdown > 0) {
        const f = g.waveCountdown / g.waveCountdownMax;
        ring.style.background = `conic-gradient(#ffd23f ${(1 - f) * 360}deg, rgba(0,0,0,.25) 0)`;
        ring.style.mask = ring.style.webkitMask = 'radial-gradient(circle, transparent 66%, #000 67%)';
      } else ring.style.background = 'none';
      const pv = b.querySelector('.wavepreview') as HTMLElement;
      const items = preview.filter((q) => s.paths.includes(q.path));
      const key = items.map((q) => q.enemy + q.count).join(',') + (g.waveIdx === -1 ? 'first' : '');
      if (pv.dataset.key !== key) {
        pv.dataset.key = key;
        pv.innerHTML = (g.waveIdx === -1 ? '<div class="wp-title outlined">タップで開始</div>' : '') + items.slice(0, 5).map((q) => `<div class="wp"><img class="portrait" src="${rigPortrait(ENEMY[q.enemy].model)}"><span class="outlined">x${q.count}</span></div>`).join('');
      }
      pv.classList.toggle('left', x > window.innerWidth * 0.6);
    });
  }

  // ───────────────────────── info bar ─────────────────────────
  private updateInfo() {
    const s = this.sel;
    const g = this.game;
    if (!s || s.kind === 'spot') { this.infobar.style.display = 'none'; return; }
    if (s.kind === 'enemy') {
      const e = g.enemies.find((x) => x.id === s.id);
      if (!e) { this.sel = null; this.infobar.style.display = 'none'; return; }
      const key = 'e' + e.id;
      if (this.infobar.dataset.key !== key) {
        this.infobar.dataset.key = key;
        const d = e.def;
        this.infobar.innerHTML = `<img class="portrait" src="${rigPortrait(d.model)}"><div><div class="name">${d.name}</div><div class="hpbar"><i></i></div><div class="meta"><span>⚔ ${d.dmg[0]}-${d.dmg[1]}</span><span>🛡 物理${armorWord(d.armor)}</span><span>✦ 魔法${armorWord(d.mr)}</span><span>${ICON.heart.replace('<svg', '<svg width="14" height="14"')} ${d.lives}</span>${d.tags.map((t) => `<span class="tagchip">${t}</span>`).join('')}</div></div>`;
      }
      (this.infobar.querySelector('.hpbar i') as HTMLElement).style.width = pct(e.hp / e.maxHp);
      this.infobar.style.display = 'flex';
      return;
    }
    if (s.kind === 'hero') { this.infobar.style.display = 'none'; return; }
    if (s.kind === 'tower') {
      const t = g.towers.find((x) => x.id === s.id);
      if (!t) { this.infobar.style.display = 'none'; return; }
      this.updateInfoTower(t);
    }
  }

  private updateInfoTower(t: Tower) {
    if (small()) { this.infobar.style.display = 'none'; return; }
    const key = 't' + t.id + t.def.id + t.kills;
    if (this.infobar.dataset.key === key) return;
    this.infobar.dataset.key = key;
    const d = t.def;
    const g = this.game;
    const s = d.soldiers;
    const meta = s
      ? `<span>兵士 ${s.count}</span><span>体力 ${s.hp}</span><span>⚔ ${s.dmg[0]}-${s.dmg[1]}</span><span>🛡 ${pct(s.armor)}</span>`
      : `<span>⚔ ${d.dmg[0]}-${d.dmg[1]}</span><span>射程 ${g.range(t).toFixed(1)}</span><span>撃破 ${t.kills}</span>`;
    this.infobar.innerHTML = `<img class="portrait" src="${towerPortrait(d.model, d.tier)}"><div><div class="name">${d.name}</div><div class="meta">${meta}</div></div>`;
    this.infobar.style.display = 'flex';
  }

  // ───────────────────────── events ─────────────────────────
  private onEvent(ev: GEvent) {
    const w = this.host.world;
    switch (ev.type) {
      case 'sfx': audio.play(ev.name); break;
      case 'gold': {
        const p = w.project(ev.x, 1.5, ev.y);
        if (p.visible) this.float(p.x, p.y, `+${ev.amount}`, 'gold');
        audio.play('coin');
        break;
      }
      case 'lifeLost': {
        const p = w.project(ev.e.x, 1.5, ev.e.y);
        this.float(p.x, p.y, `-${ev.amount}`, 'life');
        break;
      }
      case 'death': audio.play(ev.e.def.boss ? 'bigboom' : 'hit'); break;
      case 'waveStart': {
        const g = this.game;
        const last = ev.wave === g.waves.length - 1;
        this.banner(last ? '最終ウェーブ!' : `ウェーブ ${ev.wave + 1}`, last ? '全力で守り抜け!' : '');
        if (last && g.stage.boss) audio.startMusic(5);
        break;
      }
      case 'spawn':
        if (ev.e.def.boss && !this.bossAnnounced) {
          this.bossAnnounced = true;
          this.banner('ボス出現!', ev.e.def.name);
          audio.play('summon');
          w.shakeCamera(0.4);
        }
        break;
      case 'newEnemy':
        if (ENEMY[ev.id].flying) this.queueTip('flying');
        if (this.host.markSeen(ev.id)) this.newQueue.push(ev.id);
        if (!this.showingNew && this.newQueue.length) this.showNewEnemy();
        break;
      case 'levelUp': {
        const p = w.project(ev.u.x, 2.5, ev.u.y);
        this.float(p.x, p.y, 'レベルアップ!', 'bonus');
        break;
      }
      case 'towerFrozen': {
        const p = w.project(ev.tower.x, 3, ev.tower.y);
        this.float(p.x, p.y, '凍結!', 'life');
        break;
      }
    }
  }

  private showNewEnemy() {
    const id = this.newQueue.shift();
    if (!id) { this.showingNew = false; return; }
    const d = ENEMY[id];
    this.showingNew = true;
    this.host.setPaused(true, 'new');
    audio.play('newEnemy');
    const ov = el('div', 'overlay');
    const m = el('div', 'modal panel newenemy');
    m.innerHTML = `<div class="ribbon ${d.boss ? '' : 'purple'}">${d.boss ? 'ボス出現!' : '新しい敵!'}</div>
      <img class="portrait pic" src="${rigPortrait(d.model)}">
      <h2 style="margin:4px 0">${d.name}</h2>
      <div>${d.desc}</div>
      <div class="stats"><span>体力 <b>${hpWord(d.hp)}</b></span><span>速さ <b>${speedWord(d.speed)}</b></span><span>物理防御 <b>${armorWord(d.armor)}</b></span><span>魔法防御 <b>${armorWord(d.mr)}</b></span></div>
      <div class="tags">${d.tags.map((t) => `<span class="tagchip">${t}</span>`).join('')}</div>
      <div style="margin-top:14px"><button class="btn big">OK!</button></div>`;
    ov.appendChild(m);
    this.host.ui.appendChild(ov);
    (m.querySelector('button') as HTMLElement).onclick = () => {
      audio.play('click');
      ov.remove();
      if (this.newQueue.length) this.showNewEnemy();
      else { this.showingNew = false; this.host.setPaused(false, 'new'); }
    };
  }

  float(x: number, y: number, text: string, cls: string) {
    const f = el('div', 'float outlined ' + cls, text);
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    this.root.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  banner(big: string, sub: string) {
    const b = el('div', 'banner outlined', `<div class="big">${big}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`);
    this.root.appendChild(b);
    setTimeout(() => b.remove(), 2300);
  }

  // ───────────────────────── tutorial (hand-guided) ─────────────────────────
  private startTutorial() {
    const g = this.game;
    const p0 = g.paths[0];
    const near = (f: number, skip: number[]) => {
      const q = p0.at(p0.length * f);
      let best = -1, bd = Infinity;
      for (const s of g.spots) {
        if (skip.includes(s.id)) continue;
        const d = Math.hypot(s.x - q.x, s.y - q.y);
        if (d < bd) { bd = d; best = s.id; }
      }
      return best;
    };
    const a = near(0.32, []);
    this.tutSpots = [a, near(0.5, [a])];
    this.tut = 'spot1';
    this.host.guide.onSkip = () => this.endTutorial(false);
    const s0 = g.spots[a];
    this.host.world.focus(s0.x * 0.6, s0.y * 0.6);
  }

  private endTutorial(celebrate: boolean) {
    this.tut = '';
    this.host.guide.hide();
    this.host.guide.onSkip = null;
    this.host.setPaused(false, 'tut');
    this.host.finishTutorial();
    if (celebrate) this.banner('チュートリアル完了!', 'あとは自由に黄金の卵を守り抜こう!');
  }

  private spotTarget(id: number): GuideTarget | null {
    const s = this.game.spots[id];
    if (!s) return null;
    const p = this.host.world.project(s.x, 0.3, s.y);
    const p2 = this.host.world.project(s.x + 1.4, 0.3, s.y);
    return { x: p.x, y: p.y, r: Math.max(30, Math.abs(p2.x - p.x) + 8) };
  }
  private optTarget(key: string): GuideTarget | null {
    return rectTarget(this.radial?.querySelector(`.ropt[data-key="${key}"]`), 8);
  }

  private updateTutorial(dt: number) {
    const G = this.host.guide;
    if (!this.tut) return;
    const g = this.game;
    if (this.showingNew) { G.hide(); return; }
    if (!this.host.isPaused() || this.tut === 'spot1' || this.tut === 'pick1' || this.tut === 'conf1' || this.tut === 'wave') this.tutT += dt;
    const pause = () => this.host.setPaused(true, 'tut');
    switch (this.tut) {
      case 'spot1': G.show('ここは敵の通り道。<b>空き地をタップ</b>してタワーを建てよう!', () => this.spotTarget(this.tutSpots[0])); break;
      case 'pick1': G.show('<b>弓兵</b>を選ぼう。空の敵も撃てる万能タワーだ。', () => this.optTarget('archer')); break;
      case 'conf1': G.show('緑の円が攻撃範囲。<b>もう一度タップ</b>で建設!', () => this.optTarget('archer')); break;
      case 'wave': G.show(this.waveArmed === 0 ? '<b>もう一度タップ</b>で敵部隊を呼び込む!' : 'バトルスタート!<b>ドクロ</b>をタップすると敵がやって来る。', () => rectTarget(this.waveBtns[0], 8)); break;
      case 'w1': {
        G.hide();
        const front = g.enemies.reduce((m, e) => Math.max(m, e.d / e.path.length), 0);
        if ((this.tutT > 6 || front > 0.25) && g.gold >= 70) { pause(); this.tut = 'spot2'; }
        break;
      }
      case 'spot2': G.show('敵が来た!兵士で道をふさごう。<b>こっちの空き地</b>をタップ。', () => this.spotTarget(this.tutSpots[1])); break;
      case 'pick2': G.show('<b>兵舎</b>を選ぼう。兵士が敵を足止めしてくれる。', () => this.optTarget('barracks')); break;
      case 'conf2': G.show('<b>もう一度タップ</b>で建設!', () => this.optTarget('barracks')); break;
      case 'heroWait':
        G.hide();
        if (this.tutT > 3 && g.hero && !g.hero.dead) { pause(); this.tut = 'hero'; }
        break;
      case 'hero': G.show('こちらはヒーローの<b>コッカ</b>。ボタンをタップして選ぼう。', () => rectTarget(this.heroBtn, 6)); break;
      case 'heroMove': {
        // a point on the road that is clear of towers
        let p = g.paths[0].at(g.paths[0].length * 0.42), bestD = -1;
        for (let f = 0.3; f <= 0.62; f += 0.04) {
          const q = g.paths[0].at(g.paths[0].length * f);
          const d = Math.min(...g.towers.map((t) => Math.hypot(t.x - q.x, t.y - q.y)), 99);
          if (d > bestD) { bestD = d; p = q; }
        }
        G.show('移動したい場所をタップ。ヒーローはどこでも戦えるよ!', () => { const s = this.host.world.project(p.x, 0.2, p.y); return { x: s.x, y: s.y, r: 34 }; });
        break;
      }
      case 'w2': {
        G.hide();
        if (g.waveIdx >= 1 && g.meteorCd <= 0 && this.tutT > 4) {
          let best: { x: number; y: number } | null = null, bc = 0;
          for (const e of g.enemies) {
            if (e.def.flying || e.d / e.path.length < 0.15) continue;
            const c = g.enemies.filter((o) => !o.def.flying && Math.hypot(o.x - e.x, o.y - e.y) < 2.6).length;
            if (c > bc) { bc = c; best = { x: e.x, y: e.y }; }
          }
          if (best && bc >= 3) { this.tutCluster = best; pause(); this.tut = 'met'; }
        }
        break;
      }
      case 'met': G.show('敵が固まっている!<b>卵メテオ</b>のボタンをタップ。', () => rectTarget(this.meteorBtn, 6)); break;
      case 'metT': {
        const c = this.tutCluster!;
        G.show('<b>敵の群れ</b>をタップしてメテオを落とそう!', () => { const s = this.host.world.project(c.x, 0.3, c.y); return { x: s.x, y: s.y, r: 44 }; });
        break;
      }
      case 'w3': {
        G.hide();
        const t = g.towers.find((x) => x.id === this.tutTower);
        if (!t || !t.def.next.length) { this.endTutorial(true); break; }
        if (this.tutT > 3 && g.gold >= g.towerCost(TOWER[t.def.next[0]])) { pause(); this.tut = 'up1'; }
        break;
      }
      case 'up1': {
        const t = g.towers.find((x) => x.id === this.tutTower);
        if (!t) { this.endTutorial(true); break; }
        G.show('金貨がたまった!<b>弓兵の塔</b>をタップして強化しよう。', () => { const s = this.host.world.project(t.x, 1.4, t.y); return { x: s.x, y: s.y, r: 42 }; });
        break;
      }
      case 'up2': G.show('<b>強化ボタン</b>をタップ。', () => this.optTarget('up')); break;
      case 'up2c': G.show('<b>もう一度タップ</b>で強化!', () => this.optTarget('up')); break;
      case 'end': this.endTutorial(true); break;
    }
    G.update();
  }
}

function fmtVal(v: number): string {
  if (v > 0 && v < 1) return Math.round(v * 100) + '%';
  return String(v);
}
export function armorWord(a: number): string {
  if (a <= 0.01) return 'なし';
  if (a < 0.35) return '低';
  if (a < 0.65) return '中';
  if (a < 0.9) return '高';
  return '最高';
}
export function speedWord(s: number): string { return s < 0.8 ? 'とても遅い' : s < 1.2 ? '遅い' : s < 1.7 ? '普通' : s < 2.2 ? '速い' : 'とても速い'; }
export function hpWord(h: number): string { return h < 60 ? '低' : h < 200 ? '普通' : h < 600 ? '高' : h < 2000 ? 'とても高い' : '桁外れ'; }
export { HERO_XP };
