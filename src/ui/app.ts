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
import { rigPortrait, towerPortrait, initPortraits, warmPortraits, rigSilhouette } from './portraits.ts';
import { Hud, armorWord, speedWord, hpWord } from './hud.ts';
import { Guide, rectTarget } from './guide.ts';
import { MapView } from '../render/mapview.ts';

const el = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
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
  speed = 1;
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
      if (!this.paused) {
        const steps = this.speed;
        for (let i = 0; i < steps; i++) {
          g.update(dt);
          if (g.events.length) { events = events.concat(g.events); g.events.length = 0; }
        }
      }
      this.world.frame(this.paused ? 0 : dt, events);
      this.hud?.update(events, dt);
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
      <div class="credit">© コッコ砦ディフェンス</div>`;
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
    });
    const top = el('div', 'map-top');
    top.innerHTML = `<div class="hud-chip starcount outlined">${ICON.star}<span>${totalStars(d)} / ${STAGES.length * 5}</span></div>`;
    const back = el('button', 'btn wood small', 'タイトルへ');
    back.onclick = () => { audio.play('click'); this.showTitle(); };
    top.appendChild(back);
    s.appendChild(top);
    const bottom = el('div', 'map-dock');
    const mk = (label: string, icon: string, cls: string, fn: () => void) => {
      const b = el('button', 'dockbtn ' + cls, `<span class="dk-ic">${icon}</span><span class="dk-lb outlined">${label}</span>`);
      b.onclick = () => { audio.play('click'); fn(); };
      bottom.appendChild(b);
      return b;
    };
    const avail = totalStars(d) - spentStars(d);
    const ub = mk('強化', ICON.up, 'gold', () => this.showUpgrades());
    if (avail > 0) ub.insertAdjacentHTML('beforeend', `<span class="dk-badge outlined">${avail}</span>`);
    mk('ヒーロー', ICON.hero, 'blue', () => this.showHeroes());
    mk('図鑑', ICON.book, 'purple', () => this.showEncyclopedia());
    mk('設定', ICON.gear, 'wood', () => this.showSettings());
    s.appendChild(bottom);
    if (this.preTutorial) this.preTutorial = 'map';
  }

  private showBriefing(i: number) {
    const st = STAGES[i];
    const d = this.data;
    const pr = d.progress[i];
    let mode: Mode = 'campaign';
    const { m, ov } = this.modal('brief', '');
    ov.classList.add('brief-ov');
    if (this.preTutorial) this.preTutorial = 'brief';
    const close = m.querySelector('.close') as HTMLElement | null;
    if (close) { const prev = close.onclick; close.onclick = (e) => { if (this.preTutorial) this.preTutorial = 'map'; prev?.call(close, e); }; }
    const render = () => {
      const heroicOk = pr.stars > 0, ironOk = pr.stars >= 3;
      const h = HERO[d.hero];
      m.querySelector('.bcontent')?.remove();
      const c = el('div', 'bcontent');
      const modes = (['campaign', 'heroic', 'iron'] as Mode[]).filter((k) => k === 'campaign' || (k === 'heroic' ? heroicOk : ironOk));
      c.innerHTML = `<div class="brief-head r${st.region}"><div class="brief-num outlined">${i + 1}</div><div><div class="brief-region">${REGIONS[st.region].name}</div><h2>${st.name}</h2></div></div>
        <div class="brief-stars">${[0, 1, 2].map((k) => (k < pr.stars ? ICON.star : ICON.starEmpty)).join('')}</div>
        <div class="desc">${st.desc}</div>
        ${modes.length > 1 ? `<div class="tabs center">${modes.map((k) => `<div class="tab ${mode === k ? 'on' : ''}" data-mode="${k}">${MODE_INFO[k].name}${(k === 'heroic' && pr.heroic) || (k === 'iron' && pr.iron) ? ' ★' : ''}</div>`).join('')}</div>
          ${mode !== 'campaign' ? `<div class="modeinfo">${MODE_INFO[mode].desc.replace(/\(.*?\)/, '')}${mode === 'iron' ? ` 使えるタワー: <b>${st.iron.map((l) => LINE_INFO[l].name).join('・')}</b>` : ''}</div>` : ''}` : ''}
        <div class="brief-go"><button class="btn big red" data-act="go">${ICON.sword.replace('<svg', '<svg width="30" height="30"')} 出撃!</button></div>
        <div class="brief-opts">
          <button class="chipbtn" data-act="hero"><img src="${rigPortrait(h.model)}"><span>${h.name} Lv${heroLevelFromXp(d.heroXp[h.id] ?? 0)}</span></button>
          <button class="chipbtn" data-act="diff"><span class="diff d${d.difficulty}">${DIFF_NAMES[d.difficulty]}</span></button>
        </div>`;
      m.appendChild(c);
      c.querySelectorAll<HTMLElement>('[data-mode]').forEach((t) => t.onclick = () => { audio.play('click'); mode = t.dataset.mode as Mode; render(); });
      (c.querySelector('[data-act=diff]') as HTMLElement).onclick = () => { audio.play('click'); d.difficulty = (d.difficulty + 1) % 3; save(); render(); };
      (c.querySelector('[data-act=hero]') as HTMLElement).onclick = () => { audio.play('click'); this.showHeroes(() => render()); };
      (c.querySelector('[data-act=go]') as HTMLElement).onclick = () => { audio.play('horn'); ov.remove(); this.startStage(i, mode); };
    };
    render();
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
    this.ended = false;
    this.speed = 1;
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

  openPauseMenu() {
    if (!this.game || this.ended) return;
    this.setPaused(true, 'menu');
    const { m, ov } = this.modal('menu', `<div class="ribbon">一時停止</div>`, false);
    const add = (label: string, cls: string, fn: () => void) => {
      const b = el('button', 'btn ' + cls, label);
      b.onclick = () => { audio.play('click'); fn(); };
      m.appendChild(b);
    };
    add('再開', 'big', () => { ov.remove(); this.setPaused(false, 'menu'); });
    add('やり直す', 'gold', () => { ov.remove(); this.startStage(this.stageIdx, this.mode); });
    add('設定', 'wood', () => this.showSettings());
    add('マップへ戻る', 'red', () => { ov.remove(); this.leaveGame(false); });
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
    let newStars = 0;
    if (won) {
      if (this.mode === 'campaign' && stars > pr.stars) { newStars = stars - pr.stars; pr.stars = stars; }
      if (this.mode === 'heroic' && !pr.heroic) { pr.heroic = true; newStars = 1; }
      if (this.mode === 'iron' && !pr.iron) { pr.iron = true; newStars = 1; }
    }
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
    const { m, ov } = this.modal('result', `
      <img class="chicken" src="${rigPortrait(won ? HERO[h].model : 'chick_reinf')}">
      <div class="ribbon ${won ? 'green' : ''}">${won ? (this.stageIdx === STAGES.length - 1 && this.mode === 'campaign' ? '王国に平和が戻った!' : 'ステージクリア!') : '卵が奪われた…'}</div>
      <div class="bigstars">${Array.from({ length: shown }, () => ICON.star).join('')}</div>
      <div class="line">残りライフ: <b>${Math.max(0, g.lives)}</b> / ${g.maxLives}　倒した敵: <b>${g.stats.kills}</b></div>
      <div class="line">ヒーロー経験値 +${xpGain}${afterLv > beforeLv ? ` <b style="color:#3a78d0">レベルアップ! Lv${afterLv}</b>` : ''}</div>
      ${newStars > 0 ? `<div class="line"><b>★ ${newStars} 獲得!</b> アップグレードに使えます</div>` : ''}
      ${unlockHero ? `<div class="line" style="color:#7a4fd6"><b>新しいヒーロー「${unlockHero.name}」が仲間になった!</b></div>` : ''}
      ${this.stageIdx === STAGES.length - 1 && won && this.mode === 'campaign' ? '<div class="line">九尾の魔狐は倒れ、黄金の卵は守られた。ありがとう、コッコ王国の英雄!</div>' : ''}
      <div class="btns"></div>`, false);
    const sv = m.querySelectorAll('.bigstars svg');
    const lit = won ? (this.mode === 'campaign' ? stars : 1) : 0;
    sv.forEach((s, k) => { if (k < lit) setTimeout(() => { s.classList.add('on'); audio.play('star'); }, 500 + k * 450); });
    const btns = m.querySelector('.btns')!;
    const add = (label: string, cls: string, fn: () => void) => {
      const b = el('button', 'btn ' + cls, label);
      b.onclick = () => { audio.play('click'); ov.remove(); fn(); };
      btns.appendChild(b);
    };
    add('マップへ', 'wood', () => this.showMap());
    add('もう一度', 'gold', () => this.startStage(this.stageIdx, this.mode));
    if (won && next && this.mode === 'campaign') add('次のステージへ', 'big', () => { this.showMap(); this.showBriefing(this.stageIdx + 1); });
    audio.startMusic(0);
  }

  // ───────────────────────── upgrades ─────────────────────────
  showUpgrades() {
    const d = this.data;
    let sel: { t: number; l: number } | null = null;
    const { m } = this.modal('upg2', '');
    const art = (id: string) => {
      switch (id) {
        case 'archer': return `<img src="${towerPortrait('archer', 3)}">`;
        case 'barracks': return `<img src="${towerPortrait('barracks', 3)}">`;
        case 'mage': return `<img src="${towerPortrait('mage', 3)}">`;
        case 'artillery': return `<img src="${towerPortrait('artillery', 3)}">`;
        case 'meteor': return `<div class="ug-svg meteor">${ICON.meteorArt}</div>`;
        default: return `<img src="${rigPortrait('chick_reinf')}">`;
      }
    };
    const render = (burst?: { t: number; l: number }) => {
      const avail = totalStars(d) - spentStars(d);
      const total = totalStars(d);
      if (!sel) {
        // preselect the first thing the player can afford
        for (let ti = 0; ti < UPGRADES.length && !sel; ti++) {
          const lv = d.upgrades[UPGRADES[ti].id];
          if (lv < 5 && UPGRADES[ti].levels[lv].cost <= avail) sel = { t: ti, l: lv };
        }
        sel ??= { t: 0, l: Math.min(4, d.upgrades.archer) };
      }
      m.querySelector('.ucontent')?.remove();
      const c = el('div', 'ucontent');
      const T = UPGRADES[sel.t], L = T.levels[sel.l];
      const owned = d.upgrades[T.id] > sel.l;
      const isNext = d.upgrades[T.id] === sel.l;
      const canBuy = isNext && avail >= L.cost;
      c.innerHTML = `
        <div class="ug-top"><div class="ribbon">研究所</div>
          <div class="ug-stars outlined">${ICON.star}<b>${avail}</b><small>/ ${total}</small></div></div>
        <div class="ug-grid">${UPGRADES.map((t, ti) => {
          const lv = d.upgrades[t.id];
          return `<div class="ug-card ${sel!.t === ti ? 'on' : ''}" data-card="${ti}">
            <div class="ug-art">${art(t.id)}</div>
            <div class="ug-info"><div class="ug-name">${t.name}</div><div class="ug-lv">Lv ${lv}/5</div></div>
            <div class="ug-track">${t.levels.map((lvd, li) => {
              const o = lv > li, nx = lv === li;
              const cls = o ? 'owned' : nx ? (avail >= lvd.cost ? 'avail' : 'next') : 'lock';
              return `<div class="ug-node ${cls} ${sel!.t === ti && sel!.l === li ? 'sel' : ''} ${burst && burst.t === ti && burst.l === li ? 'burst' : ''}" data-t="${ti}" data-l="${li}">${o ? ICON.check : `<span>${li + 1}</span>`}</div>`;
            }).join('<i class="ug-link"></i>')}</div>
          </div>`;
        }).join('')}</div>
        <div class="ug-detail">
          <div class="ug-dart">${art(T.id)}</div>
          <div class="ug-dtext"><div class="ug-dname">${T.name} ${sel.l + 1} ・ ${L.name}</div><div>${L.desc}</div>
            ${!owned && !isNext ? `<div class="ug-note">前のレベルを先に習得しよう</div>` : ''}</div>
          <div class="ug-dact">
            <button class="btn ${owned ? 'gray' : canBuy ? 'gold big' : 'gray'}" data-act="buy">${owned ? '習得済み' : `${ICON.star.replace('<svg', '<svg width="22" height="22"')} ${L.cost} 習得`}</button>
            <button class="btn small wood" data-act="reset">★を返してやり直す</button>
          </div>
        </div>`;
      m.appendChild(c);
      c.querySelectorAll<HTMLElement>('.ug-node').forEach((n) => n.onclick = (e) => { e.stopPropagation(); audio.play('click'); sel = { t: Number(n.dataset.t), l: Number(n.dataset.l) }; render(); });
      c.querySelectorAll<HTMLElement>('.ug-card').forEach((n) => n.onclick = () => {
        audio.play('click');
        const ti = Number(n.dataset.card);
        sel = { t: ti, l: Math.min(4, d.upgrades[UPGRADES[ti].id]) };
        render();
      });
      (c.querySelector('[data-act=buy]') as HTMLElement).onclick = () => {
        if (!canBuy) { audio.play('deny'); return; }
        d.upgrades[T.id]++; save(); audio.play('upgrade');
        const done = { ...sel! };
        if (sel!.l < 4) sel = { t: sel!.t, l: sel!.l + 1 };
        render(done);
      };
      (c.querySelector('[data-act=reset]') as HTMLElement).onclick = () => { audio.play('sell'); d.upgrades = emptyUpgrades(); save(); sel = null; render(); };
    };
    render();
  }

  // ───────────────────────── heroes ─────────────────────────
  showHeroes(onClose?: () => void) {
    const d = this.data;
    const { m, ov } = this.modal('ency', '');
    const render = () => {
      m.querySelector('.hcontent')?.remove();
      const c = el('div', 'hcontent');
      c.innerHTML = `<div class="ribbon blue">ヒーロー</div><div class="heroes">${HEROES.map((h) => {
        const unlocked = h.unlockStage < 0 || d.progress[h.unlockStage]?.stars > 0;
        const xp = d.heroXp[h.id] ?? 0;
        const lv = heroLevelFromXp(xp);
        const nextXp = HERO_XP[Math.min(HERO_MAX_LV - 1, lv)];
        const prevXp = HERO_XP[lv - 1];
        const f = lv >= HERO_MAX_LV ? 1 : (xp - prevXp) / (nextXp - prevXp);
        const bar = (label: string, v: number) => `<div class="bar"><span style="width:44px">${label}</span><i><b style="width:${Math.min(100, v * 100)}%"></b></i></div>`;
        return `<div class="herocard ${d.hero === h.id ? 'sel' : ''} ${unlocked ? '' : 'locked'}">
          <img class="portrait" src="${rigPortrait(h.model)}">
          <h3>${unlocked ? h.name : '???'}</h3><div class="ttl">${h.title}</div>
          ${unlocked ? `<div>Lv ${lv}</div><div class="xpbar"><i style="width:${f * 100}%"></i></div>
          ${bar('体力', (h.hp + h.hpLv * 9) / 1300)}${bar('攻撃', (h.dmg[1] + h.dmgLv * 9) / 60)}${bar('防御', h.armor / 0.6)}${bar('射程', h.ranged ? h.ranged.range / 8 : 0.15)}
          <div class="desc">${h.desc}</div>
          <div class="skills">${h.skills.map((s) => `<div>◆ <b>${s.name}</b>: ${s.desc}</div>`).join('')}</div>
          <button class="btn small ${d.hero === h.id ? 'gray' : 'blue'}" data-h="${h.id}">${d.hero === h.id ? '選択中' : '選ぶ'}</button>`
          : `<div class="desc">ステージ${h.unlockStage + 1}をクリアすると仲間になる</div>`}
        </div>`;
      }).join('')}</div>`;
      m.appendChild(c);
      c.querySelectorAll<HTMLElement>('[data-h]').forEach((b) => b.onclick = () => { audio.play('cluck'); d.hero = b.dataset.h!; save(); render(); onClose?.(); });
    };
    render();
    void ov;
  }

  // ───────────────────────── encyclopedia ─────────────────────────
  showEncyclopedia() {
    const d = this.data;
    let tab: 'towers' | 'enemies' = 'towers';
    let selId = 'archer1';
    const { m } = this.modal('ency', '');
    const render = () => {
      m.querySelector('.econtent')?.remove();
      const c = el('div', 'econtent');
      const list = tab === 'towers'
        ? TOWERS.map((t) => ({ id: t.id, img: towerPortrait(t.model, t.tier), known: true }))
        : ENEMIES.map((e) => ({ id: e.id, img: d.seen.includes(e.id) ? rigPortrait(e.model) : rigSilhouette(e.model), known: true }));
      let detail = '';
      if (tab === 'towers') {
        const t = TOWERS.find((x) => x.id === selId) ?? TOWERS[0];
        const s = t.soldiers;
        detail = `<img class="portrait" src="${towerPortrait(t.model, t.tier)}"><h3>${t.name}</h3><div style="font-size:12px;color:#7a4a26;font-weight:800">${LINE_INFO[t.line].name} ・ ランク${t.tier}</div><p>${t.desc}</p>
          <div class="stats"><b>費用</b><span>${t.cost} G</span>${s ? `<b>兵士</b><span>${s.name} x${s.count}</span><b>体力</b><span>${s.hp}</span><b>攻撃</b><span>${s.dmg[0]}-${s.dmg[1]}</span><b>防御</b><span>${Math.round(s.armor * 100)}%</span><b>復活</b><span>${s.respawn}秒</span>`
          : `<b>攻撃</b><span>${t.dmg[0]}-${t.dmg[1]} (${t.dmgType === 'magic' ? '魔法' : t.dmgType === 'explosive' ? '爆発' : '物理'})</span><b>間隔</b><span>${t.rate}秒</span><b>射程</b><span>${t.range}</span>${t.aoe ? `<b>範囲</b><span>${t.aoe}</span>` : ''}<b>対空</b><span>${t.hitsFlying ? '○' : '×'}</span>`}
          ${t.abilities ? t.abilities.map((a) => `<b>${a.name}</b><span>${a.desc}</span>`).join('') : ''}</div>`;
      } else {
        const e = ENEMY[selId] ?? ENEMIES[0];
        const known = d.seen.includes(e.id);
        detail = known ? `<img class="portrait" src="${rigPortrait(e.model)}"><h3>${e.name}</h3><div>${e.tags.map((t) => `<span class="tagchip">${t}</span>`).join(' ')}</div><p>${e.desc}</p>
          <div class="stats"><b>体力</b><span>${e.hp} (${hpWord(e.hp)})</span><b>速さ</b><span>${speedWord(e.speed)}</span><b>物理防御</b><span>${armorWord(e.armor)}</span><b>魔法防御</b><span>${armorWord(e.mr)}</span><b>攻撃</b><span>${e.dmg[0]}-${e.dmg[1]}</span><b>報酬</b><span>${e.gold} G</span><b>ライフ</b><span>-${e.lives}</span><b>出現地</b><span>${REGIONS[e.region].name}</span></div>`
          : `<img class="portrait" src="${rigSilhouette(e.model)}"><h3>???</h3><p>まだ出会っていない敵です。</p>`;
      }
      c.innerHTML = `<div class="ribbon purple">図鑑</div>
        <div class="tabs" style="margin-top:10px"><div class="tab ${tab === 'towers' ? 'on' : ''}" data-tab="towers">タワー (${TOWERS.length})</div><div class="tab ${tab === 'enemies' ? 'on' : ''}" data-tab="enemies">敵 (${d.seen.filter((x) => ENEMY[x]).length}/${ENEMIES.length})</div></div>
        <div class="ency-body"><div class="ency-grid">${list.map((x) => `<img class="portrait ${x.known ? '' : 'unknown'} ${x.id === selId ? 'sel' : ''}" data-id="${x.id}" src="${x.img}">`).join('')}</div><div class="ency-detail">${detail}</div></div>`;
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
