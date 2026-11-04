import { World } from '../render/world.ts';
import { Game, type GEvent } from '../sim/game.ts';
import { STAGES, REGIONS, stageEnemies, type Mode } from '../data/stages.ts';
import { ENEMIES, ENEMY } from '../data/enemies.ts';
import { TOWERS, LINE_INFO, LINES } from '../data/towers.ts';
import { HEROES, HERO, HERO_XP, HERO_MAX_LV, heroLevelFromXp } from '../data/heroes.ts';
import { UPGRADES, emptyUpgrades } from '../data/upgrades.ts';
import { load, save, resetSave, totalStars, spentStars, stageUnlocked, type SaveData } from '../save.ts';
import { audio } from '../audio/audio.ts';
import { ICON, starsHtml } from './icons.ts';
import { rigPortrait, towerPortrait, initPortraits, warmPortraits, rigSilhouette } from './portraits.ts';
import { Hud, armorWord, speedWord, hpWord } from './hud.ts';

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
  private paused = false;
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
    initPortraits(this.world.renderer);
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
      this.hud?.update(events);
      for (const ev of events) if (ev.type === 'end' && !this.ended) { this.ended = true; setTimeout(() => this.showResult(ev.won), 1600); }
    } else if (this.screen === 'title' && this.demo) {
      this.demoStep(dt);
      events = this.demo.events.slice();
      this.demo.events.length = 0;
      this.world.frame(dt, events);
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  private onKey(e: KeyboardEvent) {
    if (this.screen !== 'game' || !this.game) return;
    if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); if (this.paused) this.closeOverlays(); else this.openPauseMenu(); }
  }

  setPaused(p: boolean) { this.paused = p; }
  isPaused() { return this.paused; }

  private clearScreen() {
    this.screenEl?.remove();
    this.screenEl = null;
    this.closeOverlays(false);
  }

  private closeOverlays(unpause = true) {
    this.ui.querySelectorAll('.overlay').forEach((o) => o.remove());
    if (unpause && this.screen === 'game') this.paused = false;
  }

  private modal(cls: string, html: string, closable = true): { ov: HTMLElement; m: HTMLElement } {
    const ov = el('div', 'overlay');
    const m = el('div', 'modal panel ' + cls, html);
    if (closable) {
      const c = el('button', 'btn iconbtn red close', ICON.close);
      c.onclick = () => { audio.play('click'); ov.remove(); if (this.screen === 'game' && !this.ui.querySelector('.overlay')) this.paused = false; };
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
      <div class="press outlined">16のステージ・36種の敵・16種のタワー</div>
      <div class="credit">© コッコ砦ディフェンス</div>`;
    (s.querySelector('button') as HTMLElement).onclick = () => { audio.unlock(); audio.play('cluck'); this.showMap(); };
    this.ui.appendChild(s);
    this.screenEl = s;
    audio.startMusic(0);
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
    this.world.renderer.domElement.style.display = 'none';
    this.clearScreen();
    this.hud?.destroy();
    this.hud = null;
    this.game = null;
    audio.startMusic(0);
    const d = this.data;
    const s = el('div', 'map-screen');
    s.innerHTML = mapSvg(d);
    const top = el('div', 'map-top');
    top.innerHTML = `<div class="hud-chip starcount outlined">${ICON.star}<span>${totalStars(d)} / ${STAGES.length * 5}</span></div>`;
    const back = el('button', 'btn wood small', 'タイトルへ');
    back.onclick = () => { audio.play('click'); this.showTitle(); };
    top.appendChild(back);
    s.appendChild(top);
    const bottom = el('div', 'map-bottom');
    const mk = (label: string, icon: string, cls: string, fn: () => void) => {
      const b = el('button', 'btn ' + cls, icon.replace('<svg', '<svg width="26" height="26"') + label);
      b.onclick = () => { audio.play('click'); fn(); };
      bottom.appendChild(b);
      return b;
    };
    const avail = totalStars(d) - spentStars(d);
    const ub = mk('アップグレード', ICON.up, 'gold', () => this.showUpgrades());
    if (avail > 0) ub.insertAdjacentHTML('beforeend', `<span style="position:absolute;top:-10px;right:-10px;background:#e5533a;border:3px solid #2b1a10;border-radius:14px;padding:0 7px;font-size:15px">${avail}</span>`);
    mk('ヒーロー', ICON.hero, 'blue', () => this.showHeroes());
    mk('図鑑', ICON.book, 'purple', () => this.showEncyclopedia());
    mk('', ICON.gear, 'wood iconbtn', () => this.showSettings());
    s.appendChild(bottom);
    s.querySelectorAll<SVGGElement>('.mapnode').forEach((n) => {
      const i = Number(n.dataset.i);
      n.addEventListener('click', () => {
        if (!stageUnlocked(d, i)) { audio.play('deny'); return; }
        audio.play('click');
        this.showBriefing(i);
      });
    });
    this.ui.appendChild(s);
    this.screenEl = s;
  }

  private showBriefing(i: number) {
    const st = STAGES[i];
    const d = this.data;
    const pr = d.progress[i];
    let mode: Mode = 'campaign';
    const enemies = stageEnemies(st);
    const { m, ov } = this.modal('brief', '');
    const render = () => {
      const heroicOk = pr.stars > 0, ironOk = pr.stars >= 3;
      const h = HERO[d.hero];
      m.querySelector('.bcontent')?.remove();
      const c = el('div', 'bcontent');
      c.innerHTML = `<div class="ribbon ${['green', 'blue', 'purple', ''][st.region]}">ステージ ${i + 1}</div>
        <h2>${st.name}</h2>
        <div style="font-size:13px;font-weight:800;color:#7a4a26">${REGIONS[st.region].name}　${starsHtml(pr.stars).replace(/<svg/g, '<svg width="20" height="20"')}${pr.heroic ? ' <span class="tagchip" style="background:#7a4fd6">ヒロイック</span>' : ''}${pr.iron ? ' <span class="tagchip" style="background:#5a5a68">アイアン</span>' : ''}</div>
        <div class="desc">${st.desc}</div>
        <div class="tabs">${(['campaign', 'heroic', 'iron'] as Mode[]).map((k) => {
          const locked = (k === 'heroic' && !heroicOk) || (k === 'iron' && !ironOk);
          const done = (k === 'heroic' && pr.heroic) || (k === 'iron' && pr.iron);
          return `<div class="tab ${mode === k ? 'on' : ''} ${locked ? 'locked' : ''}" data-mode="${k}">${locked ? '🔒 ' : ''}${MODE_INFO[k].name}${done ? ' ★' : ''}</div>`;
        }).join('')}</div>
        <div class="modeinfo">${MODE_INFO[mode].desc}${mode === 'iron' ? `<br>使えるタワー: <b>${st.iron.map((l) => LINE_INFO[l].name).join('・')}</b>` : ''}</div>
        <div style="font-weight:800;margin-top:6px">出てくる敵</div>
        <div class="enemy-strip">${enemies.map((id) => {
          const seen = d.seen.includes(id);
          const isNew = st.newEnemies.includes(id) || st.boss === id;
          return `<img class="portrait sm ${isNew ? 'new' : ''}" title="${seen ? ENEMY[id].name : '???'}" src="${seen ? rigPortrait(ENEMY[id].model) : rigSilhouette(ENEMY[id].model)}">`;
        }).join('')}</div>
        <div class="row" style="justify-content:space-between;margin-top:10px">
          <div class="row"><img class="portrait" src="${rigPortrait(h.model)}"><div><div style="font-weight:800">${h.name} <small>Lv${heroLevelFromXp(d.heroXp[h.id] ?? 0)}</small></div><button class="btn small blue" data-act="hero">ヒーロー変更</button></div></div>
          <div><div style="font-weight:800;margin-bottom:4px">難易度</div><div class="tabs">${DIFF_NAMES.map((n, k) => `<div class="tab ${d.difficulty === k ? 'on' : ''}" data-diff="${k}">${n}</div>`).join('')}</div></div>
        </div>
        <div style="text-align:center;margin-top:14px"><button class="btn big red" data-act="go">${ICON.sword.replace('<svg', '<svg width="28" height="28"')} 出撃!</button></div>`;
      m.appendChild(c);
      c.querySelectorAll<HTMLElement>('[data-mode]').forEach((t) => t.onclick = () => {
        const k = t.dataset.mode as Mode;
        if ((k === 'heroic' && !heroicOk) || (k === 'iron' && !ironOk)) { audio.play('deny'); return; }
        audio.play('click'); mode = k; render();
      });
      c.querySelectorAll<HTMLElement>('[data-diff]').forEach((t) => t.onclick = () => { audio.play('click'); d.difficulty = Number(t.dataset.diff); save(); render(); });
      (c.querySelector('[data-act=hero]') as HTMLElement).onclick = () => { audio.play('click'); this.showHeroes(() => render()); };
      (c.querySelector('[data-act=go]') as HTMLElement).onclick = () => { audio.play('horn'); ov.remove(); this.startStage(i, mode); };
    };
    render();
  }

  // ───────────────────────── gameplay ─────────────────────────
  startStage(i: number, mode: Mode) {
    this.clearScreen();
    this.hud?.destroy();
    this.stageIdx = i;
    this.mode = mode;
    const d = this.data;
    const st = STAGES[i];
    this.tutorial = i === 0 && mode === 'campaign' && !d.tutorialDone;
    const g = new Game({ stage: st, mode, difficulty: d.difficulty, upgrades: { ...d.upgrades }, hero: { id: d.hero, xp: d.heroXp[d.hero] ?? 0 }, seenEnemies: new Set() });
    this.game = g;
    this.ended = false;
    this.paused = false;
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
    this.paused = true;
    const { m, ov } = this.modal('menu', `<div class="ribbon">一時停止</div>`, false);
    const add = (label: string, cls: string, fn: () => void) => {
      const b = el('button', 'btn ' + cls, label);
      b.onclick = () => { audio.play('click'); fn(); };
      m.appendChild(b);
    };
    add('再開', 'big', () => { ov.remove(); this.paused = false; });
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
    this.paused = true;
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
    const { m } = this.modal('upg', '');
    const render = () => {
      const avail = totalStars(d) - spentStars(d);
      m.querySelector('.ucontent')?.remove();
      const c = el('div', 'ucontent');
      c.innerHTML = `<div class="ribbon">アップグレード</div>
        <div style="margin:8px 0;display:flex;align-items:center;gap:8px;font-weight:800">${ICON.star.replace('<svg', '<svg width="26" height="26"')} 使える★: ${avail}</div>
        <div class="upg-grid">${UPGRADES.map((t, ti) => `<div class="upg-col">
          ${t.levels.map((lv, li) => {
            const owned = d.upgrades[t.id] > li;
            const av = !owned && d.upgrades[t.id] === li;
            return `<div class="upg-node ${owned ? 'owned' : av ? 'avail' : ''} ${sel && sel.t === ti && sel.l === li ? 'sel' : ''}" data-t="${ti}" data-l="${li}">${li + 1}<span class="c">${ICON.star}${lv.cost}</span></div>`;
          }).join('')}
          <div class="head"><span class="ic">${t.icon}</span>${t.name}</div></div>`).join('')}</div>
        <div class="upg-desc"></div>`;
      m.appendChild(c);
      const desc = c.querySelector('.upg-desc') as HTMLElement;
      if (sel) {
        const t = UPGRADES[sel.t], lv = t.levels[sel.l];
        const owned = d.upgrades[t.id] > sel.l;
        const canBuy = !owned && d.upgrades[t.id] === sel.l && avail >= lv.cost;
        desc.innerHTML = `<div><b style="font-size:18px">${t.name} ${sel.l + 1}: ${lv.name}</b><br>${lv.desc}</div>`;
        const b = el('button', 'btn ' + (canBuy ? 'gold' : 'gray'), owned ? '習得済み' : `${ICON.star.replace('<svg', '<svg width="20" height="20"')} ${lv.cost} で習得`);
        b.onclick = () => {
          if (!canBuy) { audio.play('deny'); return; }
          d.upgrades[t.id]++; save(); audio.play('upgrade'); render();
        };
        desc.appendChild(b);
      } else desc.innerHTML = '<div>アイコンをタップすると詳細が見られます。下から順に習得できます。</div>';
      const reset = el('button', 'btn small red', 'リセット(★を返却)');
      reset.onclick = () => { audio.play('sell'); d.upgrades = emptyUpgrades(); save(); render(); };
      desc.appendChild(reset);
      c.querySelectorAll<HTMLElement>('.upg-node').forEach((n) => n.onclick = () => { audio.play('click'); sel = { t: Number(n.dataset.t), l: Number(n.dataset.l) }; render(); });
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

// ───────────────────────── map art ─────────────────────────
function mapSvg(d: SaveData): string {
  const W = 160, H = 100;
  const px = (x: number) => 8 + x * 1.44;
  const nodes = STAGES.map((s) => ({ x: px(s.mapPos.x), y: s.mapPos.y * 0.92 + 5 }));
  const pathD = nodes.map((n, i) => (i ? 'L' : 'M') + n.x.toFixed(1) + ' ' + n.y.toFixed(1)).join(' ');
  const firstLocked = STAGES.findIndex((_, i) => d.progress[i].stars === 0);
  let deco = '';
  // trees for grassland & forest, pines for snow, rocks for volcano
  const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 70; i++) {
    const x = rand() * W, y = rand() * H;
    const r = regionAt(x, y);
    if (r < 0) continue;
    if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 6)) continue;
    if (r === 0 || r === 1) deco += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-0.4" y="0" width="0.8" height="2" fill="#6e4322"/><circle r="1.8" cy="-0.6" fill="${r ? '#2f7a4a' : '#5fb04a'}" stroke="#2b1a10" stroke-width=".3"/></g>`;
    else if (r === 2) deco += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M0 -3 L2 1 L-2 1Z" fill="#3f7a6a" stroke="#2b1a10" stroke-width=".3"/><path d="M0 -3 L1 -1 L-1 -1Z" fill="#fff"/></g>`;
    else deco += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M-1.6 1 L-0.6 -1.4 L1.2 -0.8 L1.8 1Z" fill="#4a3438" stroke="#2b1a10" stroke-width=".3"/></g>`;
  }
  const nodeSvg = STAGES.map((s, i) => {
    const n = nodes[i];
    const pr = d.progress[i];
    const unlocked = stageUnlocked(d, i);
    const isNext = i === firstLocked && unlocked;
    const col = !unlocked ? '#8a8278' : pr.stars ? ['#5fb04a', '#3f8fa8', '#6a8acc', '#d9473a'][s.region] : '#ffcf3f';
    const stars = unlocked ? [0, 1, 2].map((k) => `<path transform="translate(${(k - 1) * 3.2} 3.4) scale(.05)" d="M0 -26 L8 -8 L27 -6 L13 7 L17 27 L0 17 L-17 27 L-13 7 L-27 -6 L-8 -8Z" fill="${k < pr.stars ? '#ffd23f' : '#6a5a4a'}" stroke="#2b1a10" stroke-width="5"/>`).join('') : '';
    const badges = (pr.heroic ? `<circle cx="-3.5" cy="-5.5" r="1.3" fill="#9a6ee8" stroke="#2b1a10" stroke-width=".35"/>` : '') + (pr.iron ? `<circle cx="3.5" cy="-5.5" r="1.3" fill="#8a96a8" stroke="#2b1a10" stroke-width=".35"/>` : '');
    return `<g class="mapnode" data-i="${i}" transform="translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})" style="cursor:${unlocked ? 'pointer' : 'default'}">
      ${isNext ? `<circle r="5" fill="none" stroke="#fff" stroke-width=".6" opacity=".9"><animate attributeName="r" values="3.4;6;3.4" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0;.9" dur="1.4s" repeatCount="indefinite"/></circle>` : ''}
      <ellipse cy="1.2" rx="3.4" ry="1.1" fill="rgba(0,0,0,.3)"/>
      <path d="M-3 -4.6 h6 v3.6 l-3 2.6 l-3 -2.6Z" fill="${col}" stroke="#2b1a10" stroke-width=".55"/>
      <text y="-1.4" text-anchor="middle" font-size="3.2" font-weight="800" fill="#fff" stroke="#2b1a10" stroke-width=".7" paint-order="stroke" font-family="M PLUS Rounded 1c, sans-serif">${unlocked ? i + 1 : '🔒'}</text>
      ${stars}${badges}
    </g>`;
  }).join('');
  const labels = REGIONS.map((r, i) => {
    const pos = [[22, 96], [62, 84], [108, 8], [134, 46]][i];
    return `<text x="${pos[0]}" y="${pos[1]}" text-anchor="middle" font-size="3.4" font-weight="800" fill="#fff" stroke="#2b1a10" stroke-width=".8" paint-order="stroke" font-family="M PLUS Rounded 1c, sans-serif">${r.name}</text>`;
  }).join('');
  return `<svg class="map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0f5"/><stop offset="1" stop-color="#4a9fd8"/></linearGradient>
      <filter id="sh"><feDropShadow dx="0" dy="1.2" stdDeviation="0" flood-color="#2b1a10" flood-opacity=".55"/></filter>
    </defs>
    <rect x="-200" y="-200" width="600" height="500" fill="url(#sea)"/>
    ${[[20, 12, 10], [70, 6, 8], [140, 30, 9], [40, 34, 7], [100, 96, 9], [6, 50, 6]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.45}" fill="#fff" opacity=".7"/>`).join('')}
    <g filter="url(#sh)" stroke="#2b1a10" stroke-width=".6">
      <path d="M2 58 C6 42 22 36 36 40 C46 43 48 56 44 66 C42 76 50 86 44 96 C34 104 10 102 4 92 C-2 82 -1 68 2 58Z" fill="#86cf4f"/>
      <path d="M44 48 C52 40 70 40 82 46 C92 52 90 66 86 76 C80 88 62 90 52 84 C44 78 40 60 44 48Z" fill="#4f9a6a"/>
      <path d="M78 34 C80 18 92 6 108 4 C124 2 128 16 122 28 C118 40 104 46 92 44 C84 42 78 40 78 34Z" fill="#e9f1f8"/>
      <path d="M112 52 C118 42 134 40 146 46 C158 54 160 72 156 88 C152 100 132 102 120 96 C110 90 106 64 112 52Z" fill="#6a5058"/>
    </g>
    <path d="M100 8 L104 2 L108 8Z M112 14 L117 6 L122 14Z M90 16 L94 9 L98 16Z" fill="#fff" stroke="#8aa4cc" stroke-width=".4"/>
    <path d="M128 64 L136 50 L144 64Z" fill="#3a2a30" stroke="#2b1a10" stroke-width=".5"/><path d="M134 53 L136 50 L138 53 L137 56 L135 55Z" fill="#ff6a1a"/>
    <path d="M136 50 C134 44 140 42 138 36" stroke="#8a8078" stroke-width="1.2" fill="none" opacity=".7"/>
    <ellipse cx="62" cy="72" rx="4" ry="1.6" fill="#3a7a7a" stroke="#2b1a10" stroke-width=".3"/>
    <ellipse cx="148" cy="82" rx="3" ry="1.2" fill="#ff7a1a"/>
    ${deco}
    <path d="${pathD}" fill="none" stroke="#6e4322" stroke-width="1.3" stroke-dasharray="1.6 1.4" stroke-linecap="round" opacity=".85"/>
    <g transform="translate(${(nodes[nodes.length - 1].x + 6).toFixed(1)} ${(nodes[nodes.length - 1].y - 3).toFixed(1)})"><path d="M-3 4 V-2 L0 -5 L3 -2 V4Z" fill="#4a3048" stroke="#2b1a10" stroke-width=".5"/><circle cy="-1" r=".8" fill="#ff3a5a"/></g>
    ${labels}
    ${nodeSvg}
  </svg>`;
}

function regionAt(x: number, y: number): number {
  if (x < 42 && y > 42) return 0;
  if (x > 46 && x < 84 && y > 46 && y < 84) return 1;
  if (x > 82 && x < 122 && y > 6 && y < 40) return 2;
  if (x > 114 && y > 48 && y < 96) return 3;
  return -1;
}

export { LINES };
