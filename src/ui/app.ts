import { World } from '../render/world.ts';
import { Game, type GEvent } from '../sim/game.ts';
import { STAGES, REGIONS, type Mode } from '../data/stages.ts';
import { ENEMIES, ENEMY } from '../data/enemies.ts';
import { TOWERS, LINE_INFO, LINES } from '../data/towers.ts';
import { HEROES, HERO, HERO_XP, HERO_MAX_LV, heroLevelFromXp } from '../data/heroes.ts';
import { UPGRADES, emptyUpgrades } from '../data/upgrades.ts';
import { load, save, resetSave, totalStars, spentStars, stageUnlocked, type SaveData } from '../save.ts';
import { audio } from '../audio/audio.ts';
import { ICON, starsHtml } from './icons.ts';
import { rigPortrait, towerPortrait, initPortraits, warmPortraits, rigSilhouette, stagePreview, rigPortraitHQ } from './portraits.ts';
import { Hud, armorWord, speedWord, hpWord } from './hud.ts';
import { Guide, rectTarget } from './guide.ts';
import { ITEMS, ITEM, TIPS, gemReward, type ItemId } from '../data/items.ts';
import { MapView } from '../render/mapview.ts';

const el = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
/** battle speed relative to real time */
const GAME_SPEED = 1.5;
const DIFF_NAMES = ['かんたん', 'ふつう', 'むずかしい'];
const MODE_INFO: Record<Mode, { name: string; desc: string }> = {
  campaign: { name: 'キャンペーン', desc: 'ライフ20で全ウェーブを守り抜こう。残ったライフで最大★3。' },
  heroic: { name: 'ヒロイック', desc: '精鋭の6ウェーブ。ライフは1だけ!クリアで★+1。(キャンペーンクリアで解放)' },
  iron: { name: 'アイアン', desc: '途切れない大軍勢を1ウェーブで。使えるタワーは2種類だけ、ライフ1。クリアで★+1。(キャンペーン★3で解放)' },
};

export class App {
  world: World;
  ui: HTMLElement;
  data: SaveData;
  screen: 'title' | 'map' | 'game' = 'title';
  game: Game | null = null;
  hud: Hud | null = null;
  private pauseReasons = new Set<string>();
  private get paused() { return this.pauseReasons.size > 0; }
  guide: Guide;
  private map: MapView | null = null;
  private ended = false;
  private screenEl: HTMLElement | null = null;
  private last = performance.now();
  private stageIdx = 0;
  private mode: Mode = 'campaign';
  private demo: Game | null = null;
  private demoTimer = 0;
  tutorial = false;

  constructor(view: HTMLElement, ui: HTMLElement) {
    this.ui = ui;
    this.data = load();
    this.world = new World(view);
    this.guide = new Guide(ui);
    initPortraits(this.world.renderer);
    window.addEventListener('resize', () => this.map?.resize());
    this.applyQuality();
    audio.setVolumes(this.data.sfx, this.data.music);
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', (e) => this.onKey(e));
    const rot = el('div', 'rotate-hint outlined', '📱↻<br>横向きにするとプレイしやすくなります');
    rot.classList.add('show');
    document.getElementById('app')!.appendChild(rot);
    rot.onclick = () => rot.remove();
    this.showTitle();
    requestAnimationFrame((t) => this.loop(t));
    const jobs: (() => void)[] = [];
    for (const l of LINES) jobs.push(() => towerPortrait(LINE_INFO[l].model, 1));
    for (const h of HEROES) jobs.push(() => rigPortrait(h.model));
    for (const e of ENEMIES) jobs.push(() => { rigPortrait(e.model); rigSilhouette(e.model); });
    for (const t of TOWERS) jobs.push(() => towerPortrait(t.model, t.tier));
    warmPortraits(jobs);
  }

  private applyQuality() {
    const hi = this.data.quality === 'high';
    this.world.quality.shadows = hi;
    this.world.renderer.setPixelRatio(hi ? Math.min(2, window.devicePixelRatio || 1) : Math.min(1, window.devicePixelRatio || 1));
    this.world.resize();
  }

  // ───────────────────────── main loop ─────────────────────────
  private loop(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    let events: GEvent[] = [];
    if (this.screen === 'game' && this.game) {
      const g = this.game;
      // the battle always runs at 1.5x real time (no separate fast-forward button)
      const gdt = dt * GAME_SPEED;
      if (!this.paused) {
        const steps = Math.ceil(gdt / (1 / 40));
        for (let i = 0; i < steps; i++) {
          g.update(gdt / steps);
          if (g.events.length) { events = events.concat(g.events); g.events.length = 0; }
        }
      }
      this.world.frame(this.paused ? 0 : gdt, events);
      this.hud?.update(events, gdt);
      for (const ev of events) if (ev.type === 'end' && !this.ended) { this.ended = true; setTimeout(() => this.showResult(ev.won), 1600); }
    } else if (this.screen === 'title' && this.demo) {
      this.demoStep(dt);
      events = this.demo.events.slice();
      this.demo.events.length = 0;
      this.world.frame(dt, events);
    } else if (this.screen === 'map' && this.map) {
      this.map.frame(dt);
    }
    if (this.preTutorial) this.updatePreTutorial();
    requestAnimationFrame((t) => this.loop(t));
  }

  private onKey(e: KeyboardEvent) {
    if (this.screen !== 'game' || !this.game) return;
    if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); if (this.paused) this.closeOverlays(); else this.openPauseMenu(); }
  }

  setPaused(p: boolean, reason = 'sys') { if (p) this.pauseReasons.add(reason); else this.pauseReasons.delete(reason); }
  isPaused() { return this.paused; }

  private clearScreen() {
    this.screenEl?.remove();
    this.screenEl = null;
    this.closeOverlays(false);
  }

  private closeOverlays(unpause = true) {
    this.ui.querySelectorAll('.overlay').forEach((o) => o.remove());
    if (unpause && this.screen === 'game') this.pauseReasons.delete('menu');
  }

  private modal(cls: string, html: string, closable = true): { ov: HTMLElement; m: HTMLElement } {
    const ov = el('div', 'overlay');
    const m = el('div', 'modal panel ' + cls, html);
    if (closable) {
      const c = el('button', 'btn iconbtn red close', ICON.close);
      c.onclick = () => { audio.play('click'); ov.remove(); if (this.screen === 'game' && !this.ui.querySelector('.overlay')) this.pauseReasons.delete('menu'); };
      m.appendChild(c);
    }
    ov.appendChild(m);
    this.ui.appendChild(ov);
    return { ov, m };
  }

  // ───────────────────────── title ─────────────────────────
  private showTitle() {
    this.screen = 'title';
    this.clearScreen();
    this.world.renderer.domElement.style.display = 'block';
    this.startDemo();
    const s = el('div', 'title-screen');
    s.innerHTML = `<div class="logo"><div class="l1">コッコ<span>砦</span>ディフェンス</div><div class="l2 outlined">〜 黄金の卵を守れ! 〜</div></div>
      <button class="btn big gold">${ICON.play.replace('<svg', '<svg width="28" height="28"')} はじめる</button>
      <div class="press outlined">16のステージ・36種の敵・20種のタワー</div>
      <div class="credit">© コッコ砦ディフェンス</div>
      <div class="title-heroes">${HEROES.map((h, k) => `<img class="th th${k}" src="${rigPortraitHQ(h.model)}" alt="${h.name}">`).join('')}</div>`;
    (s.querySelector('button') as HTMLElement).onclick = () => { audio.unlock(); audio.play('cluck'); this.showMap(); };
    this.ui.appendChild(s);
    this.screenEl = s;
    audio.startMusic(0);
    this.preTutorial = !this.data.tutorialDone && this.data.progress[0].stars === 0 ? 'title' : '';
  }

  // ───────────────────────── first-run guidance (before the first stage) ─────────────────────────
  private preTutorial: '' | 'title' | 'map' | 'brief' = '';
  private updatePreTutorial() {
    const G = this.guide;
    if (this.ui.querySelector('.overlay:not(.brief-ov)')) { G.hide(); return; }
    switch (this.preTutorial) {
      case 'title': G.show('ようこそ、コッコ王国へ!<br><b>はじめる</b>をタップしよう。', () => rectTarget(this.screenEl?.querySelector('button'), 8), { skip: false }); break;
      case 'map': G.show('ここはワールドマップ。<b>最初のステージ</b>をタップしよう!', () => rectTarget(this.map?.nodeElement(0), 10), { skip: false }); break;
      case 'brief': G.show('準備ができたら<b>出撃!</b>', () => rectTarget(this.ui.querySelector('[data-act=go]'), 8), { skip: false, below: true }); break;
    }
    G.update();
  }

  private startDemo() {
    const st = STAGES[0];
    const g = new Game({ stage: st, mode: 'campaign', difficulty: 0, upgrades: emptyUpgrades(), hero: { id: 'kokka', xp: 2000 } });
    g.gold = 2000;
    const lines = ['archer1', 'barracks1', 'mage1', 'artillery1'];
    g.spots.forEach((s, i) => { if (i < 7) g.build(s.id, lines[i % 4]); });
    for (const t of g.towers) { g.upgrade(t, t.def.next[0]); }
    g.callWave();
    g.events.length = 0;
    this.demo = g;
    this.world.setStage(g);
    this.world.menuMode = true;
  }

  private demoStep(dt: number) {
    const g = this.demo!;
    g.update(dt);
    this.demoTimer += dt;
    if (g.nextWaveReady() && this.demoTimer > 6) { g.callWave(); this.demoTimer = 0; }
    if (g.state === 'won' || g.state === 'lost' || g.lives < 10) { this.startDemo(); }
    g.lives = Math.max(g.lives, 10);
  }

  // ───────────────────────── world map ─────────────────────────
  showMap() {
    this.screen = 'map';
    this.demo = null;
    this.world.menuMode = false;
    this.world.clearStage();
    this.clearScreen();
    this.hud?.destroy();
    this.hud = null;
    this.game = null;
    this.pauseReasons.clear();
    this.map?.dispose();
    this.world.renderer.domElement.style.display = 'block';
    audio.startMusic(0);
    const d = this.data;
    const s = el('div', 'map-screen');
    this.ui.appendChild(s);
    this.screenEl = s;
    this.map = new MapView(this.world.renderer, s, d, HERO[d.hero].model, (i) => {
      if (!stageUnlocked(d, i)) { audio.play('deny'); return; }
      audio.play('click');
      this.showBriefing(i);
    }, this.flyFrom);
    this.flyFrom = -1;
    this.map.renderWith = (sc, cam) => { this.world.post.enabled = this.world.quality.shadows; this.world.post.render(sc, cam); };
    const top = el('div', 'map-top');
    const back = el('button', 'btn wood small', 'タイトルへ');
    back.onclick = () => { audio.play('click'); this.showTitle(); };
    top.appendChild(back);
    top.insertAdjacentHTML('beforeend', `<div class="map-res"><div class="hud-chip outlined">${ICON.gem}<span>${d.gems}</span></div><div class="hud-chip starcount outlined">${ICON.star}<span>${totalStars(d)} / ${STAGES.length * 5}</span></div></div>`);
    s.appendChild(top);
    const bottom = el('div', 'map-dock');
    const mk = (label: string, icon: string, cls: string, fn: () => void) => {
      const b = el('button', 'dockbtn ' + cls, `<span class="dk-ic">${icon}</span><span class="dk-lb outlined">${label}</span>`);
      b.onclick = () => { audio.play('click'); fn(); };
      bottom.appendChild(b);
      return b;
    };
    const avail = totalStars(d) - spentStars(d);
    const ub = mk('アップグレード', ICON.up, 'gold', () => this.showUpgrades());
    if (avail > 0) ub.insertAdjacentHTML('beforeend', `<span class="dk-badge outlined">${avail}</span>`);
    mk('ショップ', ICON.shop, 'red', () => this.showShop());
    mk('英雄の部屋', ICON.hero, 'blue', () => this.showHeroes());
    mk('図鑑', ICON.book, 'purple', () => this.showEncyclopedia());
    s.appendChild(bottom);
    const corner = el('div', 'map-corner');
    const gear = el('button', 'dockbtn plain', `<span class="dk-ic">${ICON.gear}</span><span class="dk-lb outlined">設定</span>`);
    gear.onclick = () => { audio.play('click'); this.showSettings(); };
    corner.appendChild(gear);
    s.appendChild(corner);
    if (this.preTutorial) this.preTutorial = 'map';
  }

  private showBriefing(i: number) {
    const st = STAGES[i];
    const d = this.data;
    const pr = d.progress[i];
    let mode: Mode = 'campaign';
    const { m, ov } = this.modal('brief2', '');
    ov.classList.add('brief-ov');
    if (this.preTutorial) this.preTutorial = 'brief';
    const close = m.querySelector('.close') as HTMLElement | null;
    if (close) { const prev = close.onclick; close.onclick = (e) => { if (this.preTutorial) this.preTutorial = 'map'; prev?.call(close, e); }; }
    const preview = stagePreview(i);
    const render = () => {
      const heroicOk = pr.stars > 0, ironOk = pr.stars >= 3;
      const h = HERO[d.hero];
      m.querySelector('.bcontent')?.remove();
      const c = el('div', 'bcontent');
      const modeBtn = (k: Mode, ok: boolean, done: boolean, icon: string) =>
        `<button class="modebtn ${mode === k ? 'on' : ''} ${ok ? '' : 'locked'}" data-mode="${k}" title="${MODE_INFO[k].name}">${ok ? icon : ICON.lock}${done ? '<i class="mdone"></i>' : ''}<span>${MODE_INFO[k].name}</span></button>`;
      c.innerHTML = `<div class="bb-left">
          <div class="bb-stars">${[0, 1, 2].map((k) => (k < pr.stars ? ICON.star : ICON.starEmpty)).join('')}<i class="bb-badge h ${pr.heroic ? 'on' : ''}">H</i><i class="bb-badge i ${pr.iron ? 'on' : ''}">I</i></div>
          <div class="bb-lens"><img src="${preview}"><div class="bb-lens-shine"></div></div>
          <div class="bb-modes">${modeBtn('campaign', true, pr.stars > 0, ICON.shield)}${modeBtn('heroic', heroicOk, pr.heroic, ICON.sword)}${modeBtn('iron', ironOk, pr.iron, ICON.gear)}</div>
        </div>
        <div class="bb-right">
          <h2><span class="bb-num r${st.region} outlined">${i + 1}</span>${st.name}</h2>
          <div class="bb-mode">${MODE_INFO[mode].name}<small>${REGIONS[st.region].name}</small></div>
          <p class="bb-story">${mode === 'campaign' ? st.desc + '<br><br>' + REGIONS[st.region].desc : MODE_INFO[mode].desc.replace(/\(.*?\)/, '') + (mode === 'iron' ? `<br><br>使えるタワー: <b>${st.iron.map((l) => LINE_INFO[l].name).join('・')}</b>` : '')}</p>
          <div class="bb-foot">
            <button class="bb-hero" data-act="hero" title="ヒーロー"><img src="${rigPortrait(h.model)}"><span class="outlined">Lv${heroLevelFromXp(d.heroXp[h.id] ?? 0)}</span></button>
            <button class="chipbtn" data-act="diff"><span class="diff d${d.difficulty}">${DIFF_NAMES[d.difficulty]}</span></button>
            <button class="bb-play" data-act="go" title="出撃">${ICON.play}<span class="outlined">出撃!</span></button>
          </div>
        </div>`;
      m.appendChild(c);
      c.querySelectorAll<HTMLElement>('[data-mode]').forEach((t) => t.onclick = () => {
        const k = t.dataset.mode as Mode;
        if ((k === 'heroic' && !heroicOk) || (k === 'iron' && !ironOk)) { audio.play('deny'); this.toast(k === 'heroic' ? 'キャンペーンをクリアすると解放' : 'キャンペーンで★3を取ると解放'); return; }
        audio.play('click'); mode = k; render();
      });
      (c.querySelector('[data-act=diff]') as HTMLElement).onclick = () => { audio.play('click'); d.difficulty = (d.difficulty + 1) % 3; save(); render(); };
      (c.querySelector('[data-act=hero]') as HTMLElement).onclick = () => { audio.play('click'); this.showHeroes(() => render()); };
      (c.querySelector('[data-act=go]') as HTMLElement).onclick = () => { audio.play('horn'); ov.remove(); this.startStage(i, mode); };
    };
    render();
  }

  toast(text: string) {
    const t = el('div', 'toast outlined', text);
    this.ui.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ───────────────────────── gameplay ─────────────────────────
  startStage(i: number, mode: Mode) {
    this.clearScreen();
    this.hud?.destroy();
    this.map?.dispose();
    this.map = null;
    this.preTutorial = '';
    this.guide.hide();
    this.pauseReasons.clear();
    this.stageIdx = i;
    this.mode = mode;
    const d = this.data;
    const st = STAGES[i];
    this.tutorial = i === 0 && mode === 'campaign' && !d.tutorialDone;
    const g = new Game({ stage: st, mode, difficulty: d.difficulty, upgrades: { ...d.upgrades }, hero: { id: d.hero, xp: d.heroXp[d.hero] ?? 0 }, seenEnemies: new Set() });
    this.game = g;
    this.lockedSpells = i === 0 && mode === 'campaign' && d.progress[0].stars === 0 ? new Set(['meteor', 'reinforce']) : new Set();
    this.ended = false;
    this.screen = 'game';
    this.world.menuMode = false;
    this.world.renderer.domElement.style.display = 'block';
    this.world.setStage(g);
    this.hud = new Hud(this, g);
    audio.startMusic(1 + st.region);
    this.hud.banner(st.name, `ステージ ${i + 1} ・ ${MODE_INFO[mode].name} ・ ${DIFF_NAMES[d.difficulty]}`);
  }

  markSeen(id: string): boolean {
    if (this.data.seen.includes(id)) return false;
    this.data.seen.push(id);
    save();
    return true;
  }

  finishTutorial() { this.data.tutorialDone = true; save(); }

  lockedSpells = new Set<string>();
  private flyFrom = -1;
  itemCount(id: ItemId) { return this.data.items[id] ?? 0; }
  consumeItem(id: ItemId) { this.data.items[id] = Math.max(0, (this.data.items[id] ?? 0) - 1); save(); }
  tipSeen(id: string) { return this.data.tipsSeen.includes(id); }
  openTip(id: string) {
    const tip = TIPS.find((t) => t.id === id);
    if (!tip) return;
    if (!this.data.tipsSeen.includes(id)) { this.data.tipsSeen.push(id); save(); }
    this.setPaused(true, 'tip');
    const { m, ov } = this.modal('tipcard', `<div class="tip-ic">${ICON.tip}</div><h3>${tip.title}</h3><p>${tip.body}</p><button class="btn big">わかった!</button>`, false);
    (m.querySelector('button') as HTMLElement).onclick = () => { audio.play('click'); ov.remove(); this.setPaused(false, 'tip'); };
  }

  openPauseMenu() {
    if (!this.game || this.ended) return;
    this.setPaused(true, 'menu');
    const d = this.data;
    const { m, ov } = this.modal('board', `<div class="board-chains"></div>
      <button class="board-x" data-act="resume">${ICON.close}</button>
      <div class="board-title outlined">一時停止</div>
      <div class="board-toggles">
        <button class="tgl ${d.music > 0 ? 'on' : ''}" data-act="music">${ICON.music}<span>音楽</span></button>
        <button class="tgl ${d.sfx > 0 ? 'on' : ''}" data-act="sfx">${ICON.sound}<span>効果音</span></button>
        <button class="tgl ${d.quality === 'high' ? 'on' : ''}" data-act="quality">${ICON.gear}<span>${d.quality === 'high' ? '高画質' : '軽量'}</span></button>
      </div>
      <div class="board-btns"><button class="plank" data-act="restart">再スタート</button><button class="plank" data-act="quit">マップへ</button></div>
      <button class="btn big" data-act="resume2">${ICON.play.replace('<svg', '<svg width="24" height="24"')} 再開</button>`, false);
    const act = (k: string) => m.querySelector(`[data-act=${k}]`) as HTMLElement;
    const resume = () => { audio.play('click'); ov.remove(); this.setPaused(false, 'menu'); };
    act('resume').onclick = resume;
    act('resume2').onclick = resume;
    act('music').onclick = () => { d.music = d.music > 0 ? 0 : 0.5; audio.setVolumes(d.sfx, d.music); save(); act('music').classList.toggle('on', d.music > 0); };
    act('sfx').onclick = () => { d.sfx = d.sfx > 0 ? 0 : 0.8; audio.setVolumes(d.sfx, d.music); save(); act('sfx').classList.toggle('on', d.sfx > 0); audio.play('click'); };
    act('quality').onclick = () => { d.quality = d.quality === 'high' ? 'low' : 'high'; save(); this.applyQuality(); act('quality').classList.toggle('on', d.quality === 'high'); (act('quality').querySelector('span') as HTMLElement).textContent = d.quality === 'high' ? '高画質' : '軽量'; };
    act('restart').onclick = () => { audio.play('click'); ov.remove(); this.startStage(this.stageIdx, this.mode); };
    act('quit').onclick = () => { audio.play('click'); ov.remove(); this.leaveGame(false); };
  }

  private leaveGame(_won: boolean) {
    const g = this.game;
    if (g && g.hero) {
      // hero keeps a share of the experience even on defeat
      const h = this.data.hero;
      this.data.heroXp[h] = Math.min(HERO_XP[HERO_XP.length - 1], (this.data.heroXp[h] ?? 0) + Math.round(g.heroXpGained * (_won ? 1 : 0.5)));
      save();
    }
    this.showMap();
  }

  private showResult(won: boolean) {
    const g = this.game!;
    const d = this.data;
    const pr = d.progress[this.stageIdx];
    const stars = g.stars();
    const prevStars = pr.stars;
    let newStars = 0;
    if (won) {
      if (this.mode === 'campaign' && pr.stars === 0) this.flyFrom = this.stageIdx;
      if (this.mode === 'campaign' && stars > pr.stars) { newStars = stars - pr.stars; pr.stars = stars; }
      if (this.mode === 'heroic' && !pr.heroic) { pr.heroic = true; newStars = 1; }
      if (this.mode === 'iron' && !pr.iron) { pr.iron = true; newStars = 1; }
    }
    const gems = gemReward(won, this.mode, stars, prevStars, d.difficulty, g.waveIdx + 1);
    d.gems += gems;
    const h = d.hero;
    const xpGain = Math.round(g.heroXpGained * (won ? 1 : 0.5));
    const beforeLv = heroLevelFromXp(d.heroXp[h] ?? 0);
    d.heroXp[h] = Math.min(HERO_XP[HERO_XP.length - 1], (d.heroXp[h] ?? 0) + xpGain);
    const afterLv = heroLevelFromXp(d.heroXp[h]);
    save();
    this.setPaused(true, 'end');
    const unlockHero = won ? HEROES.find((x) => x.unlockStage === this.stageIdx) : undefined;
    const next = this.stageIdx + 1 < STAGES.length;
    const shown = this.mode === 'campaign' ? 3 : 1;
    const finale = this.stageIdx === STAGES.length - 1 && won && this.mode === 'campaign';
    const { m, ov } = this.modal('result2 ' + (won ? 'win' : 'lose'), `
      <div class="rs-emblem"><img src="${rigPortrait(won ? HERO[h].model : 'chick_reinf')}"></div>
      <div class="rs-banner"><span>${won ? '勝利' : '敗北'}</span></div>
      <div class="bigstars">${won ? Array.from({ length: shown }, () => ICON.star).join('') : ''}</div>
      <div class="rs-chest">${ICON.chest}<b class="outlined">+${gems}</b>${ICON.gem}</div>
      <div class="rs-lines">
        ${won ? `<div>残りライフ <b>${Math.max(0, g.lives)}</b> / ${g.maxLives}・倒した敵 <b>${g.stats.kills}</b></div>` : '<div>黄金の卵が奪われてしまった…。塔の配置を変えて再挑戦しよう!</div>'}
        <div>ヒーロー経験値 +${xpGain}${afterLv > beforeLv ? ` <b style="color:#3a78d0">レベルアップ! Lv${afterLv}</b>` : ''}</div>
        ${newStars > 0 ? `<div><b>★ ${newStars} 獲得!</b> 研究所で使えます</div>` : ''}
        ${unlockHero ? `<div style="color:#7a4fd6"><b>新しいヒーロー「${unlockHero.name}」が仲間になった!</b></div>` : ''}
        ${finale ? '<div>九尾の魔狐は倒れ、黄金の卵は守られた。ありがとう、コッコ王国の英雄!</div>' : ''}
      </div>
      <div class="btns"></div>`, false);
    const sv = m.querySelectorAll('.bigstars svg');
    const lit = won ? (this.mode === 'campaign' ? stars : 1) : 0;
    sv.forEach((st, k) => { if (k < lit) setTimeout(() => { st.classList.add('on'); audio.play('star'); }, 600 + k * 450); });
    setTimeout(() => m.querySelector('.rs-chest')?.classList.add('open'), 700 + lit * 450);
    const btns = m.querySelector('.btns')!;
    const add = (label: string, cls: string, fn: () => void) => {
      const b = el('button', 'plank ' + cls, label);
      b.onclick = () => { audio.play('click'); ov.remove(); fn(); };
      btns.appendChild(b);
    };
    if (won && next && this.mode === 'campaign') add('続行', 'go', () => { this.showMap(); this.showBriefing(this.stageIdx + 1); });
    else add(won ? '続行' : 'マップへ', 'go', () => this.showMap());
    add('再スタート', '', () => this.startStage(this.stageIdx, this.mode));
    if (won && next && this.mode === 'campaign') add('マップへ', '', () => this.showMap());
    audio.startMusic(0);
  }

  // ───────────────────────── upgrades ─────────────────────────
  showUpgrades() {
    const d = this.data;
    let sel: { t: number; l: number } = { t: 0, l: Math.min(4, d.upgrades.archer) };
    const { m, ov } = this.modal('upg3', '', false);
    // one picture per upgrade, so the board reads like a tech tree
    const icons: Record<string, string[]> = {
      archer: [ICON.flag, ICON.sword, ICON.up, ICON.fast, ICON.star],
      barracks: [ICON.heart, ICON.retry, ICON.shield, ICON.sword, ICON.itemHeart],
      mage: [ICON.magic, ICON.flag, ICON.coin, ICON.skull, ICON.magic],
      artillery: [ICON.itemBomb, ICON.sword, ICON.flag, ICON.coin, ICON.itemFrost],
      meteor: [ICON.retry, ICON.meteorArt, ICON.itemBomb, ICON.meteorArt, ICON.itemThunder],
      reinforce: [ICON.heart, ICON.sword, ICON.shield, ICON.chickArt, ICON.retry],
    };
    const cat: Record<string, string> = {
      archer: `<img src="${towerPortrait('archer', 1)}">`, barracks: `<img src="${towerPortrait('barracks', 1)}">`, mage: `<img src="${towerPortrait('mage', 1)}">`,
      artillery: `<img src="${towerPortrait('artillery', 1)}">`, meteor: ICON.meteorArt, reinforce: ICON.chickArt,
    };
    const render = (burst?: { t: number; l: number }) => {
      const avail = totalStars(d) - spentStars(d);
      m.querySelector('.ucontent')?.remove();
      const c = el('div', 'ucontent');
      const T = UPGRADES[sel.t], L = T.levels[sel.l];
      const owned = d.upgrades[T.id] > sel.l;
      const isNext = d.upgrades[T.id] === sel.l;
      const canBuy = isNext && avail >= L.cost;
      let grid = '';
      for (let lv = 4; lv >= 0; lv--) {
        for (let ti = 0; ti < UPGRADES.length; ti++) {
          const t = UPGRADES[ti];
          const have = d.upgrades[t.id] > lv, nx = d.upgrades[t.id] === lv;
          const cls = have ? 'owned' : nx ? (avail >= t.levels[lv].cost ? 'avail' : 'next') : 'lock';
          grid += `<button class="ut ${cls} ${sel.t === ti && sel.l === lv ? 'sel' : ''} ${burst && burst.t === ti && burst.l === lv ? 'burst' : ''}" data-t="${ti}" data-l="${lv}">${icons[t.id][lv]}<span class="ut-cost outlined">${ICON.star}${t.levels[lv].cost}</span></button>`;
        }
      }
      for (const t of UPGRADES) grid += `<div class="ut-cat">${cat[t.id]}</div>`;
      c.innerHTML = `<div class="ug3">
          <div class="ug3-board">${grid}</div>
          <div class="ug3-side">
            <div class="ug3-stars outlined">${ICON.star}<b>${avail}</b></div>
            <div class="ug3-parch">
              <div class="ug3-icon ${owned ? 'owned' : ''}">${icons[T.id][sel.l]}</div>
              <div class="ug3-cost outlined">${ICON.star}${L.cost}</div>
              <div class="ug3-name">${L.name}</div>
              <div class="ug3-track">${T.name} Lv${sel.l + 1}</div>
              <div class="ug3-desc">${L.desc}</div>
              ${owned ? '<div class="ug3-note ok">習得済み</div>' : isNext ? '' : '<div class="ug3-note">下の段から順に習得</div>'}
              <button class="plank ${canBuy ? 'go' : 'gray'}" data-act="buy">${owned ? '習得済み' : '習得する'}</button>
            </div>
            <div class="ug3-btns"><button class="plank sq" data-act="reset" title="★を返してやり直す">${ICON.retry}</button><button class="plank sq go" data-act="ok" title="閉じる">${ICON.check}</button></div>
          </div>
        </div>`;
      m.appendChild(c);
      c.querySelectorAll<HTMLElement>('.ut').forEach((n) => n.onclick = () => {
        const t = Number(n.dataset.t), l = Number(n.dataset.l);
        // tapping the selected, affordable tile buys it (quick path, like the reference)
        if (sel.t === t && sel.l === l && canBuy) { (c.querySelector('[data-act=buy]') as HTMLElement).click(); return; }
        audio.play('click'); sel = { t, l }; render();
      });
      (c.querySelector('[data-act=buy]') as HTMLElement).onclick = () => {
        if (!canBuy) { audio.play('deny'); return; }
        d.upgrades[T.id]++; save(); audio.play('upgrade');
        const done = { ...sel };
        if (sel.l < 4) sel = { t: sel.t, l: sel.l + 1 };
        render(done);
      };
      (c.querySelector('[data-act=reset]') as HTMLElement).onclick = () => { audio.play('sell'); d.upgrades = emptyUpgrades(); save(); sel = { t: sel.t, l: 0 }; render(); };
      (c.querySelector('[data-act=ok]') as HTMLElement).onclick = () => { audio.play('click'); ov.remove(); };
    };
    render();
  }

  // ───────────────────────── heroes ─────────────────────────
  showHeroes(onClose?: () => void) {
    const d = this.data;
    let selId = d.hero;
    const { m } = this.modal('heroroom', '');
    const render = () => {
      m.querySelector('.hcontent')?.remove();
      const c = el('div', 'hcontent');
      const h = HERO[selId];
      const unlocked = h.unlockStage < 0 || d.progress[h.unlockStage]?.stars > 0;
      const xp = d.heroXp[h.id] ?? 0;
      const lv = heroLevelFromXp(xp);
      const nextXp = HERO_XP[Math.min(HERO_MAX_LV - 1, lv)];
      const f = lv >= HERO_MAX_LV ? 1 : (xp - HERO_XP[lv - 1]) / (nextXp - HERO_XP[lv - 1]);
      const pips = (v: number) => Array.from({ length: 8 }, (_, k) => `<i class="${k < Math.round(v * 8) ? 'on' : ''}"></i>`).join('');
      c.innerHTML = `<div class="room-title outlined">英雄の部屋</div>
        <div class="room">
          <div class="room-grid">${HEROES.map((x) => {
            const ok = x.unlockStage < 0 || d.progress[x.unlockStage]?.stars > 0;
            return `<button class="room-slot ${x.id === selId ? 'sel' : ''} ${d.hero === x.id ? 'cur' : ''}" data-h="${x.id}"><img src="${ok ? rigPortrait(x.model) : rigSilhouette(x.model)}">${ok ? '' : `<span class="room-lock">${ICON.lock}</span>`}</button>`;
          }).join('')}</div>
          <div class="room-card ${unlocked ? '' : 'locked'}" style="--hc:${h.color}"><img src="${unlocked ? rigPortrait(h.model) : rigSilhouette(h.model)}"><div class="room-name outlined">${h.name}<small>${h.title}</small></div></div>
          <div class="room-info">
            <p>${h.desc}</p>
            <div class="room-stats">
              <span>${ICON.heart}</span><div class="pips">${pips((h.hp + h.hpLv * (lv - 1)) / 1100)}</div>
              <span>${ICON.sword}</span><div class="pips">${pips((h.dmg[1] + h.dmgLv * (lv - 1)) / 50)}</div>
              <span>${ICON.shield}</span><div class="pips">${pips(h.armor / 0.6)}</div>
              <span>${ICON.flag}</span><div class="pips">${pips(h.ranged ? h.ranged.range / 8 : 0.12)}</div>
            </div>
            ${unlocked ? `<div class="room-lv">Lv ${lv}<div class="xpbar"><i style="width:${f * 100}%"></i></div></div>` : ''}
            <div class="room-skills">${h.skills.map((k) => `<div><b>${k.name}</b> ${k.desc}</div>`).join('')}</div>
          </div>
        </div>
        <div class="room-foot">
          ${unlocked ? `<button class="plank ${d.hero === h.id ? 'gray' : 'go'}" data-act="pick">${d.hero === h.id ? '出撃中' : 'このヒーローで出撃'}</button>` : `<button class="plank lock">${ICON.lock.replace('<svg', '<svg width="22" height="22"')} ステージ${h.unlockStage + 1}でアンロック</button>`}
        </div>`;
      m.appendChild(c);
      c.querySelectorAll<HTMLElement>('[data-h]').forEach((b) => b.onclick = () => { audio.play('click'); selId = b.dataset.h!; render(); });
      const pick = c.querySelector('[data-act=pick]') as HTMLElement | null;
      if (pick) pick.onclick = () => { audio.play('cluck'); d.hero = selId; save(); render(); onClose?.(); };
    };
    render();
  }

  // ───────────────────────── shop ─────────────────────────
  showShop() {
    const d = this.data;
    let sel: ItemId = 'bomb';
    const art: Record<ItemId, string> = { bomb: ICON.itemBomb, frost: ICON.itemFrost, goldsack: ICON.itemGold, heart: ICON.itemHeart, thunder: ICON.itemThunder };
    const { m } = this.modal('shop', '');
    let say = 'いらっしゃい!ジェムは戦いに勝つと手に入るぞ。道具は戦闘中に右下から使えるんじゃ。';
    const render = () => {
      m.querySelector('.scontent')?.remove();
      const c = el('div', 'scontent');
      const it = ITEM[sel];
      const can = d.gems >= it.price;
      c.innerHTML = `<div class="shop-top"><div class="hud-chip outlined">${ICON.gem}<span>${d.gems}</span></div><div class="shop-sign outlined">コケ爺の道具屋</div></div>
        <div class="shop-body">
          <div class="shop-keeper"><img src="${rigPortrait('merchant')}"><div class="shop-say panel">${say}</div></div>
          <div class="shop-board">
            <div class="shop-items">${ITEMS.map((x) => `<button class="shop-item ${x.id === sel ? 'sel' : ''}" data-i="${x.id}">${art[x.id]}<span class="tag outlined">${ICON.gem}${x.price}</span><span class="own outlined">x${d.items[x.id] ?? 0}</span></button>`).join('')}</div>
            <div class="shop-detail"><div class="sd-art">${art[it.id]}</div><div class="sd-text"><b>${it.name}</b><div>${it.desc}</div><small>持っている数: ${d.items[it.id] ?? 0}</small></div>
              <button class="plank ${can ? 'go' : 'gray'}" data-act="buy">${ICON.gem.replace('<svg', '<svg width="20" height="20"')} ${it.price} 購入</button></div>
          </div>
        </div>`;
      m.appendChild(c);
      c.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => b.onclick = () => { audio.play('click'); sel = b.dataset.i as ItemId; render(); });
      (c.querySelector('[data-act=buy]') as HTMLElement).onclick = () => {
        if (d.gems < it.price) { audio.play('deny'); say = 'ジェムが足りんのう。ステージをクリアして集めておいで!'; render(); return; }
        d.gems -= it.price; d.items[it.id] = (d.items[it.id] ?? 0) + 1; save();
        audio.play('coin'); say = `毎度あり!「${it.name}」じゃ。いざという時に使うんじゃぞ。`;
        render();
      };
    };
    render();
  }

  // ───────────────────────── encyclopedia ─────────────────────────
  showEncyclopedia() {
    const d = this.data;
    let tab: 'home' | 'towers' | 'enemies' | 'tips' = 'home';
    let selId = 'archer1';
    const { m } = this.modal('ency', '');
    const render = () => {
      m.querySelector('.econtent')?.remove();
      const c = el('div', 'econtent');
      if (tab === 'home') {
        c.innerHTML = `<div class="ribbon purple">図鑑</div><div class="books">
          <button class="book b1" data-tab="towers"><img src="${towerPortrait('archer', 3)}"><span class="outlined">タワー</span></button>
          <button class="book b2" data-tab="enemies"><img src="${rigPortrait('slime')}"><span class="outlined">敵</span></button>
          <button class="book b3" data-tab="tips"><div class="book-ic">${ICON.tip}</div><span class="outlined">ヒント</span></button>
        </div>`;
      } else if (tab === 'tips') {
        c.innerHTML = `<div class="ribbon purple">ヒント</div><button class="btn small wood ebk" data-tab="home">← 本を選ぶ</button>
          <div class="tiplist">${TIPS.map((t) => `<div class="tipitem"><b>${t.title}</b><div>${t.body}</div></div>`).join('')}</div>`;
      } else {
        const list = tab === 'towers'
          ? TOWERS.map((t) => ({ id: t.id, img: towerPortrait(t.model, t.tier), cls: 'tl-' + t.line }))
          : ENEMIES.map((e) => ({ id: e.id, img: d.seen.includes(e.id) ? rigPortrait(e.model) : rigSilhouette(e.model), cls: '' }));
        let detail = '';
        if (tab === 'towers') {
          const t = TOWERS.find((x) => x.id === selId) ?? TOWERS[0];
          const sd = t.soldiers;
          detail = `<img class="portrait" src="${towerPortrait(t.model, t.tier)}"><h3>${t.name}</h3><div style="font-size:12px;color:#7a4a26;font-weight:800">${LINE_INFO[t.line].name} ・ ランク${t.tier}</div><p>${t.desc}</p>
            <div class="stats"><b>費用</b><span>${t.cost} G</span>${sd ? `<b>兵士</b><span>${sd.name} x${sd.count}</span><b>体力</b><span>${sd.hp}</span><b>攻撃</b><span>${sd.dmg[0]}-${sd.dmg[1]}</span><b>防御</b><span>${Math.round(sd.armor * 100)}%</span><b>復活</b><span>${sd.respawn}秒</span>`
            : `<b>攻撃</b><span>${t.dmg[0]}-${t.dmg[1]} (${t.dmgType === 'magic' ? '魔法' : t.dmgType === 'explosive' ? '爆発' : '物理'})</span><b>間隔</b><span>${t.rate}秒</span><b>射程</b><span>${t.range}</span>${t.aoe ? `<b>範囲</b><span>${t.aoe}</span>` : ''}<b>対空</b><span>${t.hitsFlying ? '○' : '×'}</span>`}
            ${t.abilities ? t.abilities.map((a) => `<b>${a.name}</b><span>${a.desc}</span>`).join('') : ''}</div>`;
        } else {
          const e = ENEMY[selId] ?? ENEMIES[0];
          const known = d.seen.includes(e.id);
          detail = known ? `<img class="portrait" src="${rigPortrait(e.model)}"><h3>${e.name}</h3><div>${e.tags.map((t) => `<span class="tagchip">${t}</span>`).join(' ')}</div><p>${e.desc}</p>
            <div class="stats"><b>体力</b><span>${e.hp} (${hpWord(e.hp)})</span><b>速さ</b><span>${speedWord(e.speed)}</span><b>物理防御</b><span>${armorWord(e.armor)}</span><b>魔法防御</b><span>${armorWord(e.mr)}</span><b>攻撃</b><span>${e.dmg[0]}-${e.dmg[1]}</span><b>報酬</b><span>${e.gold} G</span><b>ライフ</b><span>-${e.lives}</span><b>出現地</b><span>${REGIONS[e.region].name}</span></div>`
            : `<img class="portrait" src="${rigSilhouette(e.model)}"><h3>???</h3><p>まだ出会っていない敵です。</p>`;
        }
        c.innerHTML = `<div class="ribbon purple">${tab === 'towers' ? 'タワー' : `敵 (${d.seen.filter((x) => ENEMY[x]).length}/${ENEMIES.length})`}</div><button class="btn small wood ebk" data-tab="home">← 本を選ぶ</button>
          <div class="ency-body"><div class="ency-grid">${list.map((x) => `<img class="portrait ${x.cls} ${x.id === selId ? 'sel' : ''}" data-id="${x.id}" src="${x.img}">`).join('')}</div><div class="ency-detail">${detail}</div></div>`;
      }
      m.appendChild(c);
      c.querySelectorAll<HTMLElement>('[data-tab]').forEach((t) => t.onclick = () => { audio.play('click'); tab = t.dataset.tab as typeof tab; selId = tab === 'towers' ? 'archer1' : ENEMIES[0].id; render(); });
      c.querySelectorAll<HTMLElement>('[data-id]').forEach((t) => t.onclick = () => { audio.play('click'); selId = t.dataset.id!; render(); });
    };
    render();
  }

  // ───────────────────────── settings ─────────────────────────
  showSettings() {
    const d = this.data;
    const { m } = this.modal('settings', `<div class="ribbon wood" style="background:linear-gradient(#c88a4a,#8a5530)">設定</div>
      <label>効果音 <input type="range" min="0" max="1" step="0.05" value="${d.sfx}" data-k="sfx"></label>
      <label>音楽 <input type="range" min="0" max="1" step="0.05" value="${d.music}" data-k="music"></label>
      <label>画質 <span class="tabs"><span class="tab ${d.quality === 'high' ? 'on' : ''}" data-q="high">高画質</span><span class="tab ${d.quality === 'low' ? 'on' : ''}" data-q="low">軽量</span></span></label>
      <label>セーブデータ <button class="btn small red" data-act="reset">消去する</button></label>
      <div style="font-size:12px;opacity:.75">操作: タップで建設・選択 / ドラッグで移動 / ピンチ・ホイールで拡大縮小 / スペースで一時停止</div>`);
    m.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((r) => r.oninput = () => {
      if (r.dataset.k === 'sfx') d.sfx = Number(r.value); else d.music = Number(r.value);
      audio.setVolumes(d.sfx, d.music); save();
    });
    m.querySelectorAll<HTMLElement>('[data-q]').forEach((q) => q.onclick = () => {
      d.quality = q.dataset.q as 'high' | 'low'; save(); this.applyQuality();
      m.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === q));
    });
    const resetBtn = m.querySelector('[data-act=reset]') as HTMLElement;
    resetBtn.onclick = () => {
      // two-step confirmation inside the page (browser dialogs can be blocked)
      if (resetBtn.dataset.armed !== '1') {
        resetBtn.dataset.armed = '1';
        resetBtn.textContent = 'もう一度押すと消去';
        audio.play('deny');
        return;
      }
      resetSave();
      this.data = load();
      location.reload();
    };
  }
}

export { LINES };
