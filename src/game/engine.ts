import { loadSprites, type SpriteBank } from "./assets";
import { GameAudio } from "./audio";
import { Input } from "./input";
import { isHighScore, loadScores, submitScore } from "./scores";
import { loadShip, saveShip, shipDef, type ShipId } from "./ships";
import { patchHud, resetHud, type GameMode } from "./store";
import { bossForm, bossTitle, enemyStats, isBossWave, planWave, type BossForm, type EnemyKind, type Pattern } from "./waves";

const STEP = 1 / 60;
const PLAYER_R = 11;
const MAX_LIVES = 5;

type PickupKind = "multi" | "shield" | "speed" | "life";

type Enemy = {
  alive: boolean;
  kind: EnemyKind;
  form: BossForm | "none";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  w: number;
  h: number;
  hp: number;
  hpMax: number;
  score: number;
  t: number;
  fireCd: number;
  fireEvery: number;
  speed: number;
  pattern: Pattern;
  originX: number;
  flash: number;
  delay: number;
  spawnCd: number;
};

type Bullet = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  friendly: boolean;
  life: number;
  frame: number;
};

type Pickup = {
  alive: boolean;
  x: number;
  y: number;
  vy: number;
  kind: PickupKind;
  t: number;
};

type Particle = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
};

type Flash = { alive: boolean; x: number; y: number; t: number; max: number };
type Boom = { alive: boolean; x: number; y: number; t: number; max: number; scale: number };
type Floater = {
  alive: boolean;
  x: number;
  y: number;
  t: number;
  max: number;
  text: string;
  vy: number;
};

type Star = { x: number; y: number; speed: number; size: number; alpha: number; tw: number };

function pool<T>(n: number, make: () => T): T[] {
  const a: T[] = [];
  for (let i = 0; i < n; i++) a.push(make());
  return a;
}

function grab<T extends { alive: boolean }>(list: T[]): T | null {
  for (let i = 0; i < list.length; i++) if (!list[i].alive) return list[i];
  return null;
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
      jumpWave?: (n: number) => void;
    };
  }
}

export class IonWakeGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input: Input;
  audio = new GameAudio();
  sprites: SpriteBank | null = null;
  w = 390;
  h = 720;
  private raf = 0;
  private acc = 0;
  private last = 0;
  private running = false;
  private mode: GameMode = "title";
  private reduceMotion = false;
  private returnTo: GameMode = "title";
  private shipId: ShipId = "ion";

  private player = {
    x: 195,
    y: 620,
    vx: 0,
    vy: 0,
    alive: true,
    lives: 3,
    invuln: 0,
    shield: 0,
    multi: 1,
    speedT: 0,
    fireCd: 0,
    anim: 0,
    bank: 0,
  };

  private score = 0;
  private wave = 1;
  private combo = 0;
  private comboT = 0;
  private pending = 0;
  private waveT = 0;
  private waveLabel = "";
  private muted = false;
  private trauma = 0;
  private hitstop = 0;
  private t = 0;

  private enemies = pool(64, (): Enemy => ({
    alive: false,
    kind: "scout",
    form: "none",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 12,
    w: 30,
    h: 40,
    hp: 1,
    hpMax: 1,
    score: 100,
    t: 0,
    fireCd: 0,
    fireEvery: 1.6,
    speed: 70,
    pattern: "sine",
    originX: 0,
    flash: 0,
    delay: 0,
    spawnCd: 0,
  }));
  private bullets = pool(160, (): Bullet => ({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 4,
    friendly: true,
    life: 0,
    frame: 0,
  }));
  private pickups = pool(12, (): Pickup => ({
    alive: false,
    x: 0,
    y: 0,
    vy: 70,
    kind: "multi",
    t: 0,
  }));
  private particles = pool(280, (): Particle => ({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    size: 2,
    color: "#fff",
  }));
  private flashes = pool(16, (): Flash => ({ alive: false, x: 0, y: 0, t: 0, max: 0.08 }));
  private booms = pool(24, (): Boom => ({ alive: false, x: 0, y: 0, t: 0, max: 0.42, scale: 1 }));
  private floaters = pool(24, (): Floater => ({
    alive: false,
    x: 0,
    y: 0,
    t: 0,
    max: 0.8,
    text: "",
    vy: -40,
  }));
  private stars: Star[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.input = new Input(canvas);
    this.reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.resize();
    this.seedStars();
    this.shipId = loadShip();
    this.wireControlsTest();
    patchHud({ scores: loadScores(), ready: false, mode: "title", shipId: this.shipId });
    void this.boot();
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVis);
  }

  private async boot() {
    try {
      this.sprites = await loadSprites();
    } catch {
      this.sprites = null;
    }
    patchHud({ ready: true, scores: loadScores(), shipId: this.shipId });
  }

  private onResize = () => this.resize();

  private onVis = () => {
    if (document.hidden) {
      this.input.keys.clear();
      if (this.mode === "playing") this.setMode("paused");
    } else {
      this.audio.unlock();
    }
  };

  private resize() {
    const parent = this.canvas.parentElement;
    const cssW = parent?.clientWidth || window.innerWidth;
    const cssH = parent?.clientHeight || window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.floor(cssW * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const prevW = this.w;
    const prevH = this.h;
    this.w = cssW;
    this.h = cssH;
    if (prevW > 0) {
      const sx = this.w / prevW;
      const sy = this.h / prevH;
      this.player.x *= sx;
      this.player.y *= sy;
    }
    this.seedStars();
  }

  private seedStars() {
    this.stars = [];
    const layers = [
      { n: 48, speed: 14, size: 1, alpha: 0.28 },
      { n: 32, speed: 32, size: 1.4, alpha: 0.5 },
      { n: 16, speed: 64, size: 2.1, alpha: 0.8 },
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.n; i++) {
        this.stars.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          speed: layer.speed * (0.7 + Math.random() * 0.6),
          size: layer.size,
          alpha: layer.alpha * (0.5 + Math.random() * 0.5),
          tw: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  private wireControlsTest() {
    window.__controlsTest = {
      getYaw: () => -this.player.x,
      getSpeed: () => Math.hypot(this.player.vx, this.player.vy),
      getX: () => this.player.x,
      getY: () => this.player.y,
      setKeys: (codes) => this.input.setKeys(codes),
      setSteer: (v) => {
        if (v > 0.2) this.input.setKeys(["KeyA"]);
        else if (v < -0.2) this.input.setKeys(["KeyD"]);
        else this.input.setKeys([]);
      },
      jumpWave: (n) => {
        if (this.mode !== "playing") return;
        this.clearEntities();
        this.spawnWave(n);
      },
    };
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVis);
    if (window.__controlsTest) delete window.__controlsTest;
  }

  unlock() {
    this.audio.unlock();
  }

  startRun() {
    this.audio.unlock();
    this.audio.ui();
    resetHud();
    this.mode = "playing";
    this.score = 0;
    this.wave = 1;
    this.combo = 0;
    this.comboT = 0;
    this.player.lives = 3;
    this.player.shield = 0;
    this.player.multi = 1;
    this.player.speedT = 0;
    this.player.alive = true;
    this.player.invuln = 1.4;
    this.player.x = this.w * 0.5;
    this.player.y = this.h * 0.78;
    this.player.vx = 0;
    this.player.vy = 0;
    this.clearEntities();
    this.waveT = 0;
    this.pending = 0;
    this.spawnWave(1);
    this.syncHud();
  }

  togglePause() {
    if (this.mode === "playing") this.setMode("paused");
    else if (this.mode === "paused") this.resume();
  }

  resume() {
    if (this.mode !== "paused") return;
    this.audio.unlock();
    this.setMode("playing");
  }

  quitToTitle() {
    this.audio.ui();
    this.clearEntities();
    this.mode = "title";
    this.waveLabel = "";
    this.syncHud();
  }

  showScores() {
    this.audio.ui();
    if (this.mode !== "scores") {
      this.returnTo = this.mode === "playing" ? "paused" : this.mode;
    }
    this.mode = "scores";
    patchHud({ scores: loadScores() });
  }

  showHangar() {
    this.audio.ui();
    if (this.mode !== "hangar") this.returnTo = this.mode;
    this.mode = "hangar";
    this.syncHud();
  }

  setShip(id: ShipId) {
    this.shipId = id;
    saveShip(id);
    this.audio.ui();
    this.syncHud();
  }

  showHelp() {
    this.audio.ui();
    if (this.mode !== "help") this.returnTo = this.mode;
    this.mode = "help";
  }

  closeOverlay() {
    this.audio.ui();
    let back = this.returnTo;
    if (back === "playing") back = "paused";
    if (back === "scores" || back === "help" || back === "hangar") back = "title";
    this.mode = back;
    this.syncHud();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.audio.setMuted(muted);
    patchHud({ muted });
  }

  toggleMute() {
    this.setMuted(!this.muted);
  }

  submitName(name: string) {
    const scores = submitScore({
      name,
      score: this.score,
      wave: this.wave,
    });
    this.mode = "gameover";
    patchHud({ mode: "gameover", scores });
  }

  skipName() {
    this.mode = "gameover";
    this.syncHud();
  }

  private setMode(mode: GameMode) {
    this.mode = mode;
    this.syncHud();
  }

  private clearEntities() {
    for (const e of this.enemies) e.alive = false;
    for (const b of this.bullets) b.alive = false;
    for (const p of this.pickups) p.alive = false;
    for (const p of this.particles) p.alive = false;
    for (const f of this.flashes) f.alive = false;
    for (const b of this.booms) b.alive = false;
    for (const f of this.floaters) f.alive = false;
  }

  private spawnWave(n: number) {
    this.wave = n;
    this.pending = 0;
    this.waveT = 0;
    this.waveLabel = isBossWave(n) ? bossTitle(bossForm(n)).toUpperCase() : `WAVE ${String(n).padStart(2, "0")}`;
    if (isBossWave(n)) {
      this.audio.boss();
      this.trauma = Math.min(1, this.trauma + 0.4);
    } else {
      this.audio.wave();
    }
    const plan = planWave(n);
    for (const s of plan) {
      const slot = grab(this.enemies);
      if (!slot) break;
      const st = enemyStats(s.kind, n);
      slot.alive = true;
      slot.kind = s.kind;
      slot.form = s.kind === "boss" ? bossForm(n) : "none";
      slot.x = s.x * this.w;
      slot.y = (s.kind === "boss" ? -96 : -40) - s.delay * 90;
      slot.originX = slot.x;
      slot.vx = 0;
      slot.vy = st.speed;
      slot.r = st.r;
      slot.w = st.w;
      slot.h = st.h;
      slot.hp = st.hp;
      slot.hpMax = st.hp;
      slot.score = st.score;
      slot.speed = st.speed;
      slot.fireEvery = st.fire;
      slot.fireCd = 0.4 + Math.random() * 0.6;
      slot.pattern = s.pattern;
      slot.t = 0;
      slot.flash = 0;
      slot.delay = s.delay;
      slot.spawnCd = s.kind === "boss" ? 2.6 : 0;
      this.pending++;
    }
  }

  private frame = (now: number) => {
    if (!this.running) return;
    const raw = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += raw;
    this.t += raw;

    const actions = this.input.sample();
    if (actions.mute) this.toggleMute();
    if (actions.pause) {
      if (this.mode === "playing" || this.mode === "paused") this.togglePause();
    }

    if (this.hitstop > 0) {
      this.hitstop -= raw;
    } else if (this.mode === "playing") {
      while (this.acc >= STEP) {
        this.sim(STEP, actions);
        this.acc -= STEP;
      }
    } else {
      this.acc = 0;
      this.simStars(raw);
    }

    this.draw();
    this.syncHud();
    this.raf = requestAnimationFrame(this.frame);
  };

  private speedMul() {
    return this.player.speedT > 0 ? 1.45 : 1;
  }

  private sim(dt: number, a: ReturnType<Input["sample"]>) {
    this.simStars(dt);
    this.player.anim += dt;
    if (this.player.invuln > 0) this.player.invuln -= dt;
    if (this.player.speedT > 0) this.player.speedT -= dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.waveLabel) {
      this.waveT += dt;
      if (this.waveT > 1.8) this.waveLabel = "";
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.8);

    this.movePlayer(dt, a);
    if (this.player.alive) {
      this.player.fireCd -= dt;
      if (this.player.fireCd <= 0) this.firePlayer();
    }

    this.simEnemies(dt);
    this.simBullets(dt);
    this.simPickups(dt);
    this.simFx(dt);
    this.collide();
    this.checkWave();
  }

  private movePlayer(dt: number, a: ReturnType<Input["sample"]>) {
    if (!this.player.alive) return;
    const max = 340 * this.speedMul();
    const accel = 2400 * this.speedMul();
    const usingPointer = a.pointer && (this.mode === "playing");

    if (usingPointer) {
      const tx = a.pointerX;
      const ty = Math.min(this.h - 28, a.pointerY - 36);
      const k = 1 - Math.exp(-16 * dt);
      const nx = this.player.x + (tx - this.player.x) * k;
      const ny = this.player.y + (ty - this.player.y) * k;
      this.player.vx = (nx - this.player.x) / dt;
      this.player.vy = (ny - this.player.y) / dt;
      this.player.x = nx;
      this.player.y = ny;
    } else {
      const ax = a.moveX * accel;
      const ay = a.moveY * accel;
      if (ax === 0 && ay === 0) {
        const damp = Math.exp(-10 * dt);
        this.player.vx *= damp;
        this.player.vy *= damp;
      } else {
        this.player.vx += ax * dt;
        this.player.vy += ay * dt;
      }
      const sp = Math.hypot(this.player.vx, this.player.vy);
      if (sp > max) {
        this.player.vx = (this.player.vx / sp) * max;
        this.player.vy = (this.player.vy / sp) * max;
      }
      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;
    }

    const m = 44;
    this.player.x = Math.max(m, Math.min(this.w - m, this.player.x));
    this.player.y = Math.max(m + 36, Math.min(this.h - m, this.player.y));
    const targetBank = Math.max(-1, Math.min(1, this.player.vx / 280));
    this.player.bank += (targetBank - this.player.bank) * (1 - Math.exp(-12 * dt));
  }

  private firePlayer() {
    this.player.fireCd = this.player.multi >= 5 ? 0.11 : 0.14;
    const count = this.player.multi;
    const angles =
      count >= 5 ? [-0.32, -0.16, 0, 0.16, 0.32] : count >= 3 ? [-0.2, 0, 0.2] : [0];
    const speed = 560;
    for (const ang of angles) {
      const b = grab(this.bullets);
      if (!b) break;
      b.alive = true;
      b.friendly = true;
      b.x = this.player.x + Math.sin(ang) * 10;
      b.y = this.player.y - 20;
      b.vx = Math.sin(ang) * speed;
      b.vy = -Math.cos(ang) * speed;
      b.r = 5;
      b.life = 1.4;
      b.frame = 0;
    }
    const f = grab(this.flashes);
    if (f) {
      f.alive = true;
      f.x = this.player.x;
      f.y = this.player.y - 22;
      f.t = 0;
      f.max = 0.07;
    }
    this.audio.shoot();
  }

  private simEnemies(dt: number) {
    const px = this.player.x;
    const py = this.player.y;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.pattern === "sine") {
        e.x = e.originX + Math.sin(e.t * 1.8) * Math.min(54, this.w * 0.12);
        e.y += e.speed * dt;
      } else if (e.pattern === "fall") {
        e.y += e.speed * 1.15 * dt;
        e.x += Math.sin(e.t * 3 + e.originX) * 18 * dt;
      } else if (e.pattern === "dive") {
        if (e.t < 1.1) {
          const dx = px - e.x;
          const dy = py - e.y;
          const m = Math.hypot(dx, dy) || 1;
          e.vx += (dx / m) * 220 * dt;
          e.vy += (dy / m) * 220 * dt;
        } else {
          e.vy += 40 * dt;
        }
        const sp = Math.hypot(e.vx, e.vy);
        const cap = e.speed * 2.2;
        if (sp > cap) {
          e.vx = (e.vx / sp) * cap;
          e.vy = (e.vy / sp) * cap;
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      } else if (e.pattern === "boss") {
        this.moveBoss(e, dt);
      } else {
        if (e.y < this.h * 0.22) e.y += e.speed * dt;
        else {
          e.x = e.originX + Math.sin(e.t * 1.2) * 40;
          e.fireEvery = Math.max(0.7, e.fireEvery);
        }
        if (e.t > 4.2) e.y += e.speed * 1.4 * dt;
      }

      e.fireCd -= dt;
      if (e.y > 20 && e.y < this.h - 40 && e.fireCd <= 0) {
        this.enemyShoot(e);
        const rage = e.kind === "boss" && e.form === "sovereign" && e.hp < e.hpMax * 0.4;
        e.fireCd = e.fireEvery * (rage ? 0.55 : 0.85 + Math.random() * 0.3);
      }

      if (e.kind === "boss" && e.form === "hydra") {
        e.spawnCd -= dt;
        if (e.spawnCd <= 0) {
          e.spawnCd = Math.max(3.6, 5.6 - this.wave * 0.08);
          this.spawnEscort(e.x - 48, e.y + 24, "scout");
          this.spawnEscort(e.x + 48, e.y + 24, "scout");
        }
      }

      if (e.kind !== "boss" && (e.y > this.h + 50 || e.x < -60 || e.x > this.w + 60)) {
        e.alive = false;
        this.pending = Math.max(0, this.pending - 1);
      }
    }
  }

  private moveBoss(e: Enemy, dt: number) {
    const form = e.form;
    let holdY = this.h * 0.2;
    let sway = 0.55;
    let width = Math.min(120, this.w * 0.28);
    let bob = 12;
    if (form === "reaper") {
      holdY = this.h * (0.16 + (0.5 + 0.5 * Math.sin(e.t * 0.7)) * 0.16);
      sway = 1.15;
      width = Math.min(150, this.w * 0.34);
      bob = 8;
    } else if (form === "hydra") {
      holdY = this.h * 0.17;
      sway = 0.35;
      width = Math.min(110, this.w * 0.24);
      bob = 10;
    } else if (form === "sovereign") {
      const rage = e.hp < e.hpMax * 0.4;
      holdY = this.h * 0.19;
      sway = rage ? 1.05 : 0.7;
      width = Math.min(140, this.w * 0.32);
      bob = 14;
    }
    if (e.y < holdY) e.y += e.speed * dt;
    else {
      e.x = this.w * 0.5 + Math.sin(e.t * sway) * width;
      e.y = holdY + Math.sin(e.t * 0.85) * bob;
    }
    e.x = Math.max(70, Math.min(this.w - 70, e.x));
  }

  private spawnEscort(x: number, y: number, kind: EnemyKind) {
    let extras = 0;
    for (const e of this.enemies) if (e.alive && e.kind !== "boss") extras++;
    if (extras >= 6) return;
    const slot = grab(this.enemies);
    if (!slot) return;
    const st = enemyStats(kind, this.wave);
    slot.alive = true;
    slot.kind = kind;
    slot.form = "none";
    slot.x = Math.max(24, Math.min(this.w - 24, x));
    slot.y = y;
    slot.originX = slot.x;
    slot.vx = 0;
    slot.vy = st.speed;
    slot.r = st.r;
    slot.w = st.w;
    slot.h = st.h;
    slot.hp = st.hp;
    slot.hpMax = st.hp;
    slot.score = st.score;
    slot.speed = st.speed;
    slot.fireEvery = st.fire;
    slot.fireCd = 0.5;
    slot.pattern = "sine";
    slot.t = 0;
    slot.flash = 0;
    slot.delay = 0;
    slot.spawnCd = 0;
    this.pending++;
  }

  private enemyShoot(e: Enemy) {
    const fire = (vx: number, vy: number, r = 4.5) => {
      const b = grab(this.bullets);
      if (!b) return;
      b.alive = true;
      b.friendly = false;
      b.x = e.x;
      b.y = e.y + e.h * 0.28;
      b.vx = vx;
      b.vy = vy;
      b.r = r;
      b.life = 3.2;
      b.frame = 0;
    };
    const speed = 170 + this.wave * 8;
    if (e.kind === "scout") {
      fire(0, speed);
    } else if (e.kind === "fighter") {
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const m = Math.hypot(dx, dy) || 1;
      fire((dx / m) * speed, (dy / m) * speed);
    } else if (e.kind === "tank") {
      fire(-70, speed);
      fire(0, speed + 20);
      fire(70, speed);
    } else if (e.kind === "boss") {
      this.bossShoot(e, fire, speed * 0.92);
    } else {
      fire(-40, speed);
      fire(40, speed);
    }
    this.audio.enemyShot();
  }

  private bossShoot(e: Enemy, fire: (vx: number, vy: number, r?: number) => void, shot: number) {
    const aimed = (spread = 0, r = 6) => {
      const dx = this.player.x - e.x + spread;
      const dy = this.player.y - e.y;
      const m = Math.hypot(dx, dy) || 1;
      fire((dx / m) * shot, (dy / m) * shot, r);
    };
    const fan = (count: number, span: number, r = 6) => {
      const start = -span / 2;
      const step = count === 1 ? 0 : span / (count - 1);
      for (let i = 0; i < count; i++) {
        const a = start + i * step;
        fire(Math.sin(a) * shot, Math.cos(a) * shot, r);
      }
    };
    const form = e.form;
    if (form === "reaper") {
      const phase = Math.floor(e.t / 1.35) % 2;
      if (phase === 0) {
        aimed(-18);
        aimed(18);
      } else {
        fan(7, 0.95, 5);
      }
      return;
    }
    if (form === "hydra") {
      const phase = Math.floor(e.t / 2.1) % 2;
      if (phase === 0) {
        fan(9, 1.35, 5);
      } else {
        for (const ox of [-58, 0, 58]) {
          const dx = this.player.x - (e.x + ox);
          const dy = this.player.y - e.y;
          const m = Math.hypot(dx, dy) || 1;
          const b = grab(this.bullets);
          if (!b) continue;
          b.alive = true;
          b.friendly = false;
          b.x = e.x + ox;
          b.y = e.y + e.h * 0.28;
          b.vx = (dx / m) * shot;
          b.vy = (dy / m) * shot;
          b.r = 6;
          b.life = 3.2;
          b.frame = 0;
        }
      }
      return;
    }
    if (form === "sovereign") {
      const phase = Math.floor(e.t / 1.8) % 4;
      if (phase === 0) fan(7, 1.15, 7);
      else if (phase === 1) {
        const rot = e.t * 1.8;
        for (let i = 0; i < 10; i++) {
          const a = rot + (i / 10) * Math.PI * 1.1 - 0.55;
          fire(Math.sin(a) * shot, Math.cos(a) * shot, 6);
        }
      } else if (phase === 2) {
        aimed(-70);
        aimed(-35);
        aimed(0);
        aimed(35);
        aimed(70);
      } else {
        for (const x of [-120, -72, -24, 24, 72, 120]) fire(x * 0.35, shot + 10, 7);
      }
      if (e.hp < e.hpMax * 0.4) aimed(0, 7);
      return;
    }
    const phase = Math.floor(e.t / 2.4) % 3;
    if (phase === 0) fan(5, 1.16, 6);
    else if (phase === 1) {
      aimed(-55);
      aimed(0);
      aimed(55);
    } else {
      fire(-110, shot, 6);
      fire(-50, shot + 24, 6);
      fire(50, shot + 24, 6);
      fire(110, shot, 6);
    }
  }

  private simBullets(dt: number) {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.frame += dt * 10;
      if (b.life <= 0 || b.y < -20 || b.y > this.h + 20 || b.x < -20 || b.x > this.w + 20) {
        b.alive = false;
      }
    }
  }

  private simPickups(dt: number) {
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.t += dt;
      p.y += p.vy * dt;
      p.x += Math.sin(p.t * 3) * 12 * dt;
      if (p.y > this.h + 30) p.alive = false;
    }
  }

  private simFx(dt: number) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }
    for (const f of this.flashes) {
      if (!f.alive) continue;
      f.t += dt;
      if (f.t >= f.max) f.alive = false;
    }
    for (const b of this.booms) {
      if (!b.alive) continue;
      b.t += dt;
      if (b.t >= b.max) b.alive = false;
    }
    for (const f of this.floaters) {
      if (!f.alive) continue;
      f.y += f.vy * dt;
      f.t += dt;
      if (f.t >= f.max) f.alive = false;
    }
    if (this.player.alive) {
      if (Math.random() < 0.7) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.burst(
          this.player.x + side * (30 + Math.random() * 6),
          this.player.y + (Math.random() - 0.4) * 10,
          1,
          shipDef(this.shipId).trail,
          0.22,
          50,
        );
      }
    }
  }

  private simStars(dt: number) {
    const boost = this.mode === "playing" ? 1 : 0.45;
    for (const s of this.stars) {
      s.y += s.speed * boost * dt;
      if (s.y > this.h) {
        s.y -= this.h + 4;
        s.x = Math.random() * this.w;
      }
    }
  }

  private collide() {
    for (const b of this.bullets) {
      if (!b.alive || !b.friendly) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy < (b.r + e.r) * (b.r + e.r)) {
          b.alive = false;
          this.hurtEnemy(e, 1);
          break;
        }
      }
    }

    if (!this.player.alive) return;

    for (const b of this.bullets) {
      if (!b.alive || b.friendly) continue;
      const dx = b.x - this.player.x;
      const dy = b.y - this.player.y;
      if (dx * dx + dy * dy < (b.r + PLAYER_R) * (b.r + PLAYER_R)) {
        b.alive = false;
        this.hurtPlayer();
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy < (e.r + PLAYER_R) * (e.r + PLAYER_R)) {
        this.hurtPlayer();
        this.hurtEnemy(e, 2);
      }
    }

    for (const p of this.pickups) {
      if (!p.alive) continue;
      const dx = p.x - this.player.x;
      const dy = p.y - this.player.y;
      if (dx * dx + dy * dy < 28 * 28) {
        p.alive = false;
        this.collect(p.kind);
      }
    }
  }

  private hurtEnemy(e: Enemy, dmg: number) {
    e.hp -= dmg;
    e.flash = 0.08;
    this.audio.hit();
    this.burst(e.x, e.y, 4, "#f2d6c9", 0.3, 80);
    if (e.hp <= 0) {
      e.alive = false;
      this.pending = Math.max(0, this.pending - 1);
      this.combo += 1;
      this.comboT = 1.4;
      const pts = e.score * (1 + Math.min(8, this.combo - 1) * 0.15);
      this.score += Math.round(pts);
      this.float(e.x, e.y - 10, `+${Math.round(pts)}`);
      this.explode(e.x, e.y, e.kind === "boss" ? 2.4 : e.kind === "tank" ? 1.4 : 1);
      this.maybeDrop(e);
      this.trauma = Math.min(1, this.trauma + (e.kind === "boss" ? 0.85 : e.kind === "tank" ? 0.45 : 0.22));
      this.hitstop = e.kind === "boss" ? 0.09 : 0.035;
    }
  }

  private hurtPlayer() {
    if (this.player.invuln > 0 || !this.player.alive) return;
    if (this.player.shield > 0) {
      this.player.shield -= 1;
      this.player.invuln = 0.45;
      this.audio.hit();
      this.trauma = Math.min(1, this.trauma + 0.25);
      this.burst(this.player.x, this.player.y, 10, "#c5e4f2", 0.4, 140);
      return;
    }
    this.player.lives -= 1;
    this.player.multi = 1;
    this.player.speedT = 0;
    this.explode(this.player.x, this.player.y, 1.2);
    this.audio.hurt();
    this.trauma = 0.7;
    this.hitstop = 0.08;
    if (this.player.lives <= 0) {
      this.player.alive = false;
      this.player.invuln = 99;
      this.endRun();
    } else {
      this.player.invuln = 2;
    }
  }

  private maybeDrop(e: Enemy) {
    if (e.kind === "boss") {
      this.dropAt(e.x - 30, e.y, "multi");
      this.dropAt(e.x, e.y + 10, "shield");
      this.dropAt(e.x + 30, e.y, Math.random() > 0.45 ? "life" : "speed");
      return;
    }
    const chance = e.kind === "tank" ? 0.34 : e.kind === "bomber" ? 0.24 : e.kind === "fighter" ? 0.16 : 0.1;
    if (Math.random() > chance) return;
    const roll = Math.random();
    const kind: PickupKind =
      roll > 0.88 ? "life" : roll > 0.62 ? "shield" : roll > 0.35 ? "speed" : "multi";
    this.dropAt(e.x, e.y, kind);
  }

  private dropAt(x: number, y: number, kind: PickupKind) {
    const slot = grab(this.pickups);
    if (!slot) return;
    slot.alive = true;
    slot.x = x;
    slot.y = y;
    slot.vy = 72;
    slot.kind = kind;
    slot.t = 0;
  }

  private collect(kind: PickupKind) {
    this.audio.pickup();
    this.float(this.player.x, this.player.y - 28, kind.toUpperCase());
    if (kind === "multi") this.player.multi = this.player.multi >= 3 ? 5 : 3;
    else if (kind === "shield") this.player.shield = Math.min(3, this.player.shield + 1);
    else if (kind === "speed") this.player.speedT = 8;
    else this.player.lives = Math.min(MAX_LIVES, this.player.lives + 1);
  }

  private explode(x: number, y: number, scale: number) {
    const b = grab(this.booms);
    if (b) {
      b.alive = true;
      b.x = x;
      b.y = y;
      b.t = 0;
      b.max = 0.42;
      b.scale = scale;
    }
    this.burst(x, y, 14 * scale, "#e8d0c4", 0.45, 160);
    this.audio.explode();
  }

  private burst(x: number, y: number, n: number, color: string, life: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const p = grab(this.particles);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random());
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = life * (0.5 + Math.random());
      p.max = p.life;
      p.size = 1.2 + Math.random() * 2.4;
      p.color = color;
    }
  }

  private float(x: number, y: number, text: string) {
    const f = grab(this.floaters);
    if (!f) return;
    f.alive = true;
    f.x = x;
    f.y = y;
    f.t = 0;
    f.max = 0.85;
    f.text = text;
    f.vy = -46;
  }

  private checkWave() {
    if (this.mode !== "playing" || !this.player.alive) return;
    if (this.pending > 0) return;
    for (const e of this.enemies) if (e.alive) return;
    this.score += 400 + this.wave * 150;
    this.float(this.w * 0.5, this.h * 0.4, "CLEAR");
    this.spawnWave(this.wave + 1);
  }

  private endRun() {
    this.audio.gameOver();
    const high = isHighScore(this.score);
    patchHud({
      pendingScore: this.score,
      pendingWave: this.wave,
      scores: loadScores(),
    });
    this.mode = high ? "name" : "gameover";
  }

  private syncHud() {
    let bossHp = 0;
    let bossHpMax = 0;
    let bossName = "";
    for (const e of this.enemies) {
      if (e.alive && e.kind === "boss") {
        bossHp = e.hp;
        bossHpMax = e.hpMax;
        bossName = e.form === "none" ? "Boss" : bossTitle(e.form);
        break;
      }
    }
    patchHud({
      mode: this.mode,
      score: this.score,
      lives: this.player.lives,
      wave: this.wave,
      combo: this.combo,
      multi: this.player.multi,
      shield: this.player.shield,
      speed: this.player.speedT > 0,
      muted: this.muted,
      waveLabel: this.waveLabel,
      bossHp,
      bossHpMax,
      bossName,
      shipId: this.shipId,
    });
  }

  private draw() {
    const { ctx, w, h } = this;
    ctx.fillStyle = "#07080c";
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0c121c");
    g.addColorStop(0.55, "#07080c");
    g.addColorStop(1, "#05060a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    let sx = 0;
    let sy = 0;
    if (!this.reduceMotion && this.trauma > 0 && this.mode === "playing") {
      const mag = this.trauma * this.trauma * 10;
      sx = (Math.random() * 2 - 1) * mag;
      sy = (Math.random() * 2 - 1) * mag;
    }
    ctx.save();
    ctx.translate(sx, sy);

    this.drawStars();
    if (this.mode === "playing" || this.mode === "paused" || this.mode === "gameover" || this.mode === "name") {
      this.drawWorld();
    }
    ctx.restore();
  }

  private drawStars() {
    const { ctx } = this;
    for (const s of this.stars) {
      const tw = 0.65 + Math.sin(this.t * 2.2 + s.tw) * 0.35;
      ctx.globalAlpha = s.alpha * tw;
      ctx.fillStyle = "#d7dde6";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawWorld() {
    const { ctx } = this;
    for (const p of this.pickups) if (p.alive) this.drawPickup(p);
    for (const b of this.bullets) if (b.alive && !b.friendly) this.drawBullet(b);
    for (const e of this.enemies) if (e.alive) this.drawEnemy(e);
    for (const b of this.bullets) if (b.alive && b.friendly) this.drawBullet(b);
    for (const f of this.flashes) if (f.alive) this.drawMuzzle(f);
    if (this.player.alive) this.drawPlayer();
    for (const b of this.booms) if (b.alive) this.drawBoom(b);
    for (const p of this.particles) {
      if (!p.alive) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = "600 13px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    for (const f of this.floaters) {
      if (!f.alive) continue;
      ctx.globalAlpha = 1 - f.t / f.max;
      ctx.fillStyle = "#e8eaee";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  private blit(
    img: HTMLImageElement | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
    rot = 0,
    alpha = 1,
  ) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = "#c5ccd6";
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlayer() {
    const p = this.player;
    const blink = p.invuln > 0 ? 0.45 + Math.sin(this.t * 28) * 0.35 : 1;
    const frames = this.sprites?.ships[this.shipId] ?? this.sprites?.player;
    const frame = frames?.[Math.floor(p.anim * 8) % (frames.length || 1)];
    this.blit(frame, p.x, p.y, 108, 75, p.bank * 0.1, Math.max(0.35, blink));
    if (p.shield > 0) {
      const { ctx } = this;
      const rgb = shipDef(this.shipId).shield;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = `rgba(${rgb}, ${0.35 + p.shield * 0.15})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 54 + Math.sin(this.t * 6) * 1.5, 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawEnemy(e: Enemy) {
    const spr = this.sprites;
    const alpha = e.flash > 0 ? 0.55 : 1;
    if (e.kind === "boss") {
      const pack = e.form === "none" ? spr?.bosses.dreadnought : spr?.bosses[e.form];
      const img = pack?.[Math.floor(e.t * 6) % 2];
      this.blit(img, e.x, e.y, e.w, e.h, 0, alpha);
      return;
    }
    const img =
      e.kind === "scout"
        ? spr?.scout
        : e.kind === "fighter"
          ? spr?.fighter
          : e.kind === "tank"
            ? spr?.tank
            : spr?.bomber;
    this.blit(img, e.x, e.y, e.w, e.h, 0, alpha);
  }

  private drawBullet(b: Bullet) {
    const spr = this.sprites;
    if (b.friendly) {
      const img = spr?.boltPlayer[Math.floor(b.frame) % 2];
      this.blit(img, b.x, b.y, 10, 28);
    } else {
      const img = spr?.boltEnemy[Math.floor(b.frame) % 2];
      this.blit(img, b.x, b.y, 12, 22);
    }
  }

  private drawMuzzle(f: Flash) {
    const i = Math.min(3, Math.floor((f.t / f.max) * 4));
    const img = this.sprites?.muzzle[i];
    this.blit(img, f.x, f.y, 22, 28, 0, 1 - f.t / f.max);
  }

  private drawBoom(b: Boom) {
    const i = Math.min(3, Math.floor((b.t / b.max) * 4));
    const img = this.sprites?.explode[i];
    const s = 46 * b.scale * (0.7 + b.t / b.max);
    this.blit(img, b.x, b.y, s, s, 0, 1 - b.t / b.max * 0.3);
  }

  private drawPickup(p: Pickup) {
    const spr = this.sprites;
    const img =
      p.kind === "multi"
        ? spr?.pickupMulti
        : p.kind === "shield"
          ? spr?.pickupShield
          : p.kind === "speed"
            ? spr?.pickupSpeed
            : spr?.pickupLife;
    const bob = Math.sin(p.t * 5) * 2;
    this.blit(img, p.x, p.y + bob, 30, 30);
  }
}
