import type { Game, Tower, GEvent } from '../sim/game.ts';
import { SPELLS } from '../sim/game.ts';
import type { World, Pick } from '../render/world.ts';
import { TOWER, LINES, LINE_INFO, type TowerDef } from '../data/towers.ts';
import { ENEMY } from '../data/enemies.ts';
import { HERO_XP } from '../data/heroes.ts';
import { ICON } from './icons.ts';
import { rigPortrait, towerPortrait } from './portraits.ts';
import { audio } from '../audio/audio.ts';

export interface HudHost {
  world: World;
  ui: HTMLElement;
  speed: number;
  setPaused(p: boolean): void;
  isPaused(): boolean;
  openPauseMenu(): void;
  markSeen(id: string): boolean; // returns true if it was new to the save
  tutorial: boolean;
  finishTutorial(): void;
}

type Sel =
  | { kind: 'spot'; id: number }
  | { kind: 'tower'; id: number }
  | { kind: 'hero' }
  | { kind: 'enemy'; id: number }
  | null;

type Option = { key: string; dx: number; dy: number; html: string; cost?: number; onConfirm: () => boolean; info: () => string; range?: number; disabled?: boolean; instant?: boolean; maxed?: boolean };

const el = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const fmt = (n: number) => Math.round(n).toString();
const pct = (v: number) => Math.round(v * 100) + '%';

export class Hud {
  root: HTMLElement;
  private goldEl: HTMLElement;
  private livesEl: HTMLElement;
  private waveEl: HTMLElement;
  private speedBtn: HTMLButtonElement;
  private heroBtn: HTMLElement | null = null;
  private meteorBtn: HTMLElement;
  private reinfBtn: HTMLElement;
  private radial: HTMLElement | null = null;
  private radialOpts: { opt: Option; el: HTMLElement }[] = [];
  private tooltip: HTMLElement;
  private infobar: HTMLElement;
  private waveBtns: HTMLElement[] = [];
  private hintEl: HTMLElement | null = null;
  sel: Sel = null;
  private selOpt: string | null = null;
  private targeting: 'meteor' | 'reinforce' | 'rally' | null = null;
  private lastGold = -1;
  private lastLives = -1;
  private newQueue: string[] = [];
  private showingNew = false;
  private tutStep = 0;
  private bossAnnounced = false;

  constructor(private host: HudHost, private game: Game) {
    const ui = host.ui;
    this.root = el('div', 'hud passthru');
    this.root.style.cssText = 'position:absolute;inset:0;';
    ui.appendChild(this.root);

    const top = el('div', 'hud-top');
    this.livesEl = el('div', 'hud-chip outlined', ICON.heart + '<span></span>');
    this.goldEl = el('div', 'hud-chip outlined', ICON.coin + '<span></span>');
    this.waveEl = el('div', 'hud-chip outlined', ICON.wave + '<span></span>');
    top.append(this.livesEl, this.goldEl, this.waveEl);
    this.root.appendChild(top);

    const right = el('div', 'hud-right');
    this.speedBtn = el('button', 'btn iconbtn wood outlined', '') as HTMLButtonElement;
    this.speedBtn.onclick = () => { audio.play('click'); this.host.speed = this.host.speed >= 3 ? 1 : this.host.speed + 1; this.refreshSpeed(); };
    const pause = el('button', 'btn iconbtn wood', ICON.pause);
    pause.onclick = () => { audio.play('click'); this.host.openPauseMenu(); };
    right.append(this.speedBtn, pause);
    this.root.appendChild(right);
    this.refreshSpeed();

    const bottom = el('div', 'hud-bottom');
    if (game.hero) {
      const h = game.hero;
      this.heroBtn = el('div', 'skillbtn herobtn', `<img src="${rigPortrait(h.model)}"><div class="hpring"></div><div class="cdtext outlined"></div><div class="lv outlined"></div>`);
      this.heroBtn.onclick = () => { audio.play('cluck'); this.select(this.sel?.kind === 'hero' ? null : { kind: 'hero' }); };
      bottom.appendChild(this.heroBtn);
    }
    this.meteorBtn = el('div', 'skillbtn meteor', ICON.meteor + '<div class="cd"></div><div class="cdtext outlined"></div>');
    this.meteorBtn.onclick = () => this.toggleTargeting('meteor');
    this.reinfBtn = el('div', 'skillbtn reinf', ICON.chick + '<div class="cd"></div><div class="cdtext outlined"></div>');
    this.reinfBtn.onclick = () => this.toggleTargeting('reinforce');
    this.meteorBtn.title = SPELLS.meteor.name + ': ' + SPELLS.meteor.desc;
    this.reinfBtn.title = SPELLS.reinforce.name + ': ' + SPELLS.reinforce.desc;
    bottom.append(this.meteorBtn, this.reinfBtn);
    this.root.appendChild(bottom);

    this.tooltip = el('div', 'tooltip panel');
    this.tooltip.style.display = 'none';
    this.root.appendChild(this.tooltip);
    this.infobar = el('div', 'infobar woodpanel outlined');
    this.infobar.style.display = 'none';
    this.root.appendChild(this.infobar);

    host.world.onTap = (p) => this.onTap(p);
    host.world.onHover = () => {};
    if (host.tutorial) this.tutStep = 1;
  }

  destroy() {
    this.root.remove();
    this.host.world.hideRange();
    this.host.world.hideRally();
    this.host.world.showTargetMarker(null);
    this.host.world.heroSelected = false;
  }

  private refreshSpeed() { this.speedBtn.innerHTML = `<span style="font-size:20px">x${this.host.speed}</span>`; }

  // ───────────────────────── input ─────────────────────────
  private toggleTargeting(t: 'meteor' | 'reinforce') {
    const g = this.game;
    const cd = t === 'meteor' ? g.meteorCd : g.reinforceCd;
    if (cd > 0) { audio.play('deny'); return; }
    audio.play('click');
    this.closeRadial();
    this.sel = null;
    this.targeting = this.targeting === t ? null : t;
    if (this.tutStep === 4 && t === 'meteor') this.setHint(null);
  }

  onTap(p: Pick) {
    const g = this.game;
    const w = this.host.world;
    if (this.showingNew) return;
    if (this.targeting === 'meteor' || this.targeting === 'reinforce') {
      if (p.kind !== 'none' && p.inside) {
        const ok = this.targeting === 'meteor' ? g.castMeteor(p) : g.castReinforce(p);
        if (ok) { this.targeting = null; w.showTargetMarker(null); return; }
      }
      audio.play('deny');
      this.targeting = null;
      w.showTargetMarker(null);
      return;
    }
    if (this.targeting === 'rally' && this.sel?.kind === 'tower') {
      const t = g.towers.find((x) => x.id === (this.sel as any).id);
      if (t && g.setRally(t, p)) { this.targeting = null; this.select(null); return; }
      audio.play('deny');
      this.targeting = null;
      this.select({ kind: 'tower', id: t?.id ?? -1 });
      return;
    }
    if (this.sel?.kind === 'hero' && p.kind !== 'hero' && p.kind !== 'tower' && p.kind !== 'none') {
      if (p.inside) {
        g.moveHero(p);
        w.burst('dust', p.x, 0.2, p.y, 6);
        if (this.tutStep === 3) { this.tutStep = 4; this.setHint(null); }
      }
      this.select(null);
      return;
    }
    switch (p.kind) {
      case 'spot': audio.play('click'); this.select({ kind: 'spot', id: p.id }); break;
      case 'tower': audio.play('click'); this.select(this.sel?.kind === 'tower' && this.sel.id === p.id ? null : { kind: 'tower', id: p.id }); break;
      case 'hero': audio.play('cluck'); this.select(this.sel?.kind === 'hero' ? null : { kind: 'hero' }); break;
      case 'enemy': this.select({ kind: 'enemy', id: p.id }); break;
      default: this.select(null);
    }
  }

  private select(s: Sel) {
    this.sel = s;
    this.selOpt = null;
    this.closeRadial();
    const w = this.host.world;
    w.hideRange();
    w.hideRally();
    w.heroSelected = s?.kind === 'hero';
    this.tooltip.style.display = 'none';
    if (!s) return;
    if (s.kind === 'spot') this.openBuild(s.id);
    if (s.kind === 'tower') this.openTower(s.id);
  }

  // ───────────────────────── radial menus ─────────────────────────
  private closeRadial() {
    this.radial?.remove();
    this.radial = null;
    this.radialOpts = [];
    this.tooltip.style.display = 'none';
  }

  private makeRadial(opts: Option[]) {
    this.closeRadial();
    const r = el('div', 'radial');
    r.appendChild(el('div', 'ring'));
    for (const o of opts) {
      const b = el('div', 'ropt' + (o.disabled ? ' lockline' : '') + (o.maxed ? ' maxed' : ''), o.html + `<div class="confirm">${ICON.check}</div>`);
      b.style.left = o.dx + 'px';
      b.style.top = o.dy + 'px';
      b.onpointerdown = (e) => e.stopPropagation();
      b.onclick = (e) => { e.stopPropagation(); this.clickOption(o); };
      b.onmouseenter = () => this.showOptInfo(o, b);
      b.onmouseleave = () => { if (this.selOpt !== o.key) this.tooltip.style.display = 'none'; };
      r.appendChild(b);
      this.radialOpts.push({ opt: o, el: b });
    }
    this.root.appendChild(r);
    this.radial = r;
    this.positionRadial();
  }

  private clickOption(o: Option) {
    if (o.disabled) { audio.play('deny'); this.showOptInfo(o, this.radialOpts.find((x) => x.opt === o)!.el); return; }
    if (o.instant || this.selOpt === o.key) {
      if (o.cost != null && this.game.gold < o.cost) { audio.play('deny'); this.flashGold(); return; }
      const ok = o.onConfirm();
      if (!ok) { audio.play('deny'); return; }
      return;
    }
    audio.play('click');
    this.selOpt = o.key;
    for (const x of this.radialOpts) x.el.classList.toggle('sel', x.opt.key === o.key);
    this.showOptInfo(o, this.radialOpts.find((x) => x.opt === o)!.el);
    const s = this.sel;
    if (o.range && s && (s.kind === 'spot' || s.kind === 'tower')) {
      const p = s.kind === 'spot' ? this.game.spots[s.id] : this.game.towers.find((t) => t.id === s.id)!;
      this.host.world.showRange(p.x, p.y, o.range, 0x9dff7a);
    }
  }

  private showOptInfo(o: Option, b: HTMLElement) {
    this.tooltip.innerHTML = o.info();
    this.tooltip.style.display = 'block';
    const r = b.getBoundingClientRect();
    const tw = 270;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.top - 10 - this.tooltip.offsetHeight;
    if (y < 8) y = r.bottom + 14;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    if (y + this.tooltip.offsetHeight > window.innerHeight - 8) y = window.innerHeight - 8 - this.tooltip.offsetHeight;
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
    const corners = [[-62, -62], [62, -62], [-62, 62], [62, 62]];
    const opts: Option[] = LINES.map((line, i) => {
      const def = TOWER[LINE_INFO[line].base];
      const cost = g.towerCost(def);
      const allowed = g.allowedLine(line);
      return {
        key: line, dx: corners[i][0], dy: corners[i][1], cost, range: def.range,
        disabled: !allowed,
        html: `<img src="${towerPortrait(def.model, 1)}"><div class="cost">${allowed ? cost : '×'}</div>`,
        info: () => allowed ? this.towerInfo(def, cost) : `<h4>${def.name}</h4>このモードでは建てられません。`,
        onConfirm: () => {
          const ok = g.build(spotId, def.id);
          if (ok) {
            this.select(null);
            if (this.tutStep === 1) { this.tutStep = 2; this.setHint(null); }
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
      opts.push({ key: 'up', dx: 0, dy: -84, cost, range: def.range, html: `${ICON.up}<div class="cost">${cost}</div>`, info: () => this.towerInfo(def, cost), onConfirm: () => this.afterAction(g.upgrade(t, def.id), t) });
    } else if (next.length === 2) {
      next.forEach((nid, i) => {
        const def = TOWER[nid];
        const cost = g.towerCost(def);
        opts.push({ key: 'br' + i, dx: i ? 64 : -64, dy: -64, cost, range: def.range, html: `<img src="${towerPortrait(def.model, 4)}"><div class="cost">${cost}</div>`, info: () => this.towerInfo(def, cost), onConfirm: () => this.afterAction(g.upgrade(t, def.id), t) });
      });
    } else if (t.def.abilities) {
      t.def.abilities.forEach((ab, i) => {
        const lv = t.abil[ab.id] ?? 0;
        const cost = g.abilityCost(t, ab.id);
        const pips = ab.costs.map((_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
        opts.push({
          key: 'ab' + i, dx: i ? 64 : -64, dy: -64, cost: cost ?? undefined, maxed: cost == null,
          html: `<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 35%, ${i ? '#c2a2ff, #6a3fc8' : '#ffd27a, #e5533a'})"></div>${i ? ICON.magic : ICON.sword}<div class="pips">${pips}</div><div class="cost">${cost == null ? 'MAX' : cost}</div>`,
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
    opts.push({ key: 'sell', dx: 0, dy: 86, html: `${ICON.sell}<div class="cost">+${sv}</div>`, info: () => `<h4>売却</h4>このタワーを売って ${sv} G を受け取ります。`, onConfirm: () => { g.sell(t); this.select(null); return true; } });
    if (t.def.soldiers) {
      opts.push({ key: 'rally', dx: 74, dy: 40, instant: true, html: ICON.flag, info: () => `<h4>集合地点</h4>兵士の集合場所を変更します。範囲内の地面をタップしてください。`, onConfirm: () => {
        this.closeRadial();
        this.targeting = 'rally';
        w.showRange(t.x, t.y, g.range(t), 0x7ac8ff);
        return true;
      } });
    }
    this.makeRadial(opts);
    this.updateInfoTower(t);
  }

  private afterAction(ok: boolean, t: Tower): boolean {
    if (ok) this.select({ kind: 'tower', id: t.id });
    return ok;
  }

  private positionRadial() {
    if (!this.radial || !this.sel) return;
    const g = this.game;
    let x = 0, y = 0, h = 0.6;
    if (this.sel.kind === 'spot') { const s = g.spots[this.sel.id]; x = s.x; y = s.y; }
    else if (this.sel.kind === 'tower') {
      const t = g.towers.find((q) => q.id === (this.sel as any).id);
      if (!t) { this.select(null); return; }
      x = t.x; y = t.y; h = 1.6;
    }
    const p = this.host.world.project(x, h, y);
    const m = 100;
    const px = Math.max(m, Math.min(window.innerWidth - m, p.x));
    const py = Math.max(m, Math.min(window.innerHeight - m, p.y));
    this.radial.style.left = px + 'px';
    this.radial.style.top = py + 'px';
  }

  // ───────────────────────── per-frame ─────────────────────────
  update(events: GEvent[]) {
    const g = this.game;
    for (const ev of events) this.onEvent(ev);
    // top chips
    if (g.gold !== this.lastGold) { (this.goldEl.lastChild as HTMLElement).textContent = fmt(g.gold); this.lastGold = g.gold; this.refreshAffordability(); }
    if (g.lives !== this.lastLives) {
      (this.livesEl.lastChild as HTMLElement).textContent = String(Math.max(0, g.lives));
      if (this.lastLives > 0 && g.lives < this.lastLives) { this.livesEl.classList.remove('flash'); void this.livesEl.offsetWidth; this.livesEl.classList.add('flash'); }
      this.lastLives = g.lives;
    }
    (this.waveEl.lastChild as HTMLElement).textContent = `ウェーブ ${Math.max(0, g.waveIdx + 1)}/${g.waves.length}`;
    // spells
    this.cdButton(this.meteorBtn, g.meteorCd, g.spellMeteorMax, this.targeting === 'meteor');
    this.cdButton(this.reinfBtn, g.reinforceCd, g.spellReinforceMax, this.targeting === 'reinforce');
    // hero
    const h = g.hero;
    if (h && this.heroBtn) {
      const ring = this.heroBtn.querySelector('.hpring') as HTMLElement;
      const f = h.dead ? 0 : h.hp / h.maxHp;
      ring.style.background = `conic-gradient(${f > 0.5 ? '#5ad13a' : f > 0.25 ? '#ffc21a' : '#ff3a2a'} ${f * 360}deg, rgba(0,0,0,.35) 0)`;
      ring.style.mask = ring.style.webkitMask = 'radial-gradient(circle, transparent 62%, #000 63%)';
      (this.heroBtn.querySelector('.cdtext') as HTMLElement).textContent = h.dead ? Math.ceil(h.respawnT) + '' : '';
      (this.heroBtn.querySelector('img') as HTMLElement).style.filter = h.dead ? 'grayscale(1) brightness(.6)' : '';
      (this.heroBtn.querySelector('.lv') as HTMLElement).textContent = 'Lv' + h.level;
      this.heroBtn.classList.toggle('active', this.sel?.kind === 'hero');
    }
    // targeting marker follows pointer center? (shown on tap only) — show for active spell at screen center hint
    const w = this.host.world;
    if (this.targeting === 'meteor' || this.targeting === 'reinforce') {
      w.showTargetMarker(null);
    }
    this.positionRadial();
    this.updateWaveButtons();
    this.updateInfo();
    this.updateHints();
  }

  private cdButton(b: HTMLElement, cd: number, max: number, active: boolean) {
    const cdEl = b.querySelector('.cd') as HTMLElement;
    const t = b.querySelector('.cdtext') as HTMLElement;
    const f = cd > 0 ? cd / max : 0;
    cdEl.style.background = f > 0 ? `conic-gradient(rgba(20,10,4,.65) ${f * 360}deg, transparent 0)` : 'none';
    t.textContent = cd > 0 ? Math.ceil(cd) + '' : '';
    b.classList.toggle('active', active);
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
    const show = g.nextWaveReady() && !this.showingNew;
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
        b = el('div', 'wavebtn', ICON.skull + '<div class="ring"></div><div class="wavepreview"></div>');
        b.onclick = () => {
          const bonus = g.callWave();
          audio.play('horn');
          if (bonus > 0) this.float(b.getBoundingClientRect().left + 32, b.getBoundingClientRect().top, `+${bonus}`, 'bonus');
          if (this.tutStep === 2) { this.tutStep = 3; this.setHint(null); }
        };
        this.root.appendChild(b);
        this.waveBtns[i] = b;
      }
      const p = this.host.world.project(s.x + s.dx * 3, 0.5, s.y + s.dy * 3);
      const m = 44;
      const x = Math.max(m, Math.min(window.innerWidth - m - 120, p.x));
      const y = Math.max(m + 60, Math.min(window.innerHeight - m - 90, p.y));
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
        pv.innerHTML = items.slice(0, 5).map((q) => `<div class="wp"><img class="portrait" src="${rigPortrait(ENEMY[q.enemy].model)}"><span class="outlined">x${q.count}</span></div>`).join('');
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
    if (s.kind === 'hero') {
      const h = g.hero;
      if (!h) return;
      const key = 'h' + h.level;
      if (this.infobar.dataset.key !== key) {
        this.infobar.dataset.key = key;
        const hd = h.hero!;
        this.infobar.innerHTML = `<img class="portrait" src="${rigPortrait(h.model)}"><div><div class="name">${hd.name} <small>Lv${h.level}</small></div><div class="hpbar"><i></i></div><div class="meta"><span>⚔ ${h.dmg[0]}-${h.dmg[1]}</span><span>🛡 ${pct(h.armor)}</span>${hd.skills.map((k) => `<span class="tagchip">${k.name}</span>`).join('')}</div><div class="meta" style="opacity:.85">地面をタップして移動</div></div>`;
      }
      (this.infobar.querySelector('.hpbar i') as HTMLElement).style.width = pct(h.dead ? 0 : h.hp / h.maxHp);
      this.infobar.style.display = 'flex';
      return;
    }
    if (s.kind === 'tower') {
      const t = g.towers.find((x) => x.id === s.id);
      if (!t) { this.infobar.style.display = 'none'; return; }
      this.updateInfoTower(t);
    }
  }

  private updateInfoTower(t: Tower) {
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
    this.host.setPaused(true);
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
      else { this.showingNew = false; this.host.setPaused(false); }
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

  // ───────────────────────── tutorial ─────────────────────────
  private setHint(html: string | null, x = 0, y = 0) {
    if (!html) { this.hintEl?.remove(); this.hintEl = null; return; }
    if (!this.hintEl) { this.hintEl = el('div', 'hint panel'); this.root.appendChild(this.hintEl); }
    if (this.hintEl.dataset.html !== html) { this.hintEl.innerHTML = html; this.hintEl.dataset.html = html; }
    this.hintEl.style.left = Math.max(8, Math.min(window.innerWidth - 290, x - 30)) + 'px';
    this.hintEl.style.top = Math.max(8, y - this.hintEl.offsetHeight - 16) + 'px';
  }

  private updateHints() {
    if (!this.tutStep) return;
    const g = this.game;
    const w = this.host.world;
    if (this.sel || this.targeting) { if (this.tutStep !== 4) this.setHint(null); return; }
    switch (this.tutStep) {
      case 1: {
        const s = g.spots[0];
        const p = w.project(s.x, 0.5, s.y);
        this.setHint('<b>空き地</b>をタップして<br>タワーを建てよう!', p.x, p.y);
        break;
      }
      case 2: {
        const b = this.waveBtns[0];
        if (!b) { this.setHint(null); break; }
        const r = b.getBoundingClientRect();
        this.setHint('<b>ドクロ</b>をタップすると敵がやって来る!<br>早めに呼ぶとボーナス金貨!', r.left + 10, r.top);
        break;
      }
      case 3: {
        if (g.waveIdx < 1 || !g.hero) { this.setHint(null); break; }
        const h = g.hero;
        const p = w.project(h.x, 2, h.y);
        this.setHint('<b>ヒーロー</b>をタップしてから地面をタップすると移動できるよ', p.x, p.y);
        break;
      }
      case 4: {
        if (g.waveIdx < 2) { this.setHint(null); break; }
        const r = this.meteorBtn.getBoundingClientRect();
        this.setHint('<b>卵メテオ</b>で敵の群れを吹き飛ばそう!<br>ボタン→地面をタップ', r.left + 20, r.top);
        if (g.meteorCd > 0) { this.tutStep = 0; this.setHint(null); this.host.finishTutorial(); }
        break;
      }
    }
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
