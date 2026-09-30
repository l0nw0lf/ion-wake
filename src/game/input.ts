const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
  "Escape",
  "KeyP",
  "Enter",
  "KeyM",
]);

export type Actions = {
  moveX: number;
  moveY: number;
  fire: boolean;
  pause: boolean;
  mute: boolean;
  pointer: boolean;
  pointerX: number;
  pointerY: number;
};

function radialDeadzone(x: number, y: number, dz = 0.18) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = ((m - dz) / (1 - dz)) / m;
  return { x: x * scale, y: y * scale };
}

export class Input {
  keys = new Set<string>();
  injected = new Set<string>();
  pointerDown = false;
  pointerX = 0;
  pointerY = 0;
  canvas: HTMLCanvasElement;
  private prevPause = false;
  private prevMute = false;
  private unsubs: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bind();
  }

  private bind() {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) {
        if (GAME_CODES.has(e.code)) e.preventDefault();
        return;
      }
      this.keys.add(e.code);
      if (GAME_CODES.has(e.code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const clear = () => this.keys.clear();
    const onBlur = () => {
      this.keys.clear();
      this.pointerDown = false;
    };
    const onVis = () => {
      if (document.hidden) onBlur();
    };

    const point = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerX = e.clientX - rect.left;
      this.pointerY = e.clientY - rect.top;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-ui]")) return;
      point(e);
      this.pointerDown = true;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onMove = (e: PointerEvent) => {
      point(e);
    };
    const onUp = (e: PointerEvent) => {
      point(e);
      this.pointerDown = false;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    this.canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    this.unsubs.push(
      () => window.removeEventListener("keydown", onKeyDown),
      () => window.removeEventListener("keyup", onKeyUp),
      () => window.removeEventListener("blur", onBlur),
      () => document.removeEventListener("visibilitychange", onVis),
      () => this.canvas.removeEventListener("pointerdown", onDown),
      () => window.removeEventListener("pointermove", onMove),
      () => window.removeEventListener("pointerup", onUp),
      () => window.removeEventListener("pointercancel", onUp),
      clear,
    );
  }

  setKeys(codes: string[]) {
    this.injected = new Set(codes);
  }

  has(code: string) {
    return this.keys.has(code) || this.injected.has(code);
  }

  sample(): Actions {
    let mx = 0;
    let my = 0;
    if (this.has("KeyA") || this.has("ArrowLeft")) mx -= 1;
    if (this.has("KeyD") || this.has("ArrowRight")) mx += 1;
    if (this.has("KeyW") || this.has("ArrowUp")) my -= 1;
    if (this.has("KeyS") || this.has("ArrowDown")) my += 1;

    const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
    if (pads) {
      for (const pad of pads) {
        if (!pad) continue;
        const stick = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
        mx += stick.x;
        my += stick.y;
        if (pad.buttons[12]?.pressed) my -= 1;
        if (pad.buttons[13]?.pressed) my += 1;
        if (pad.buttons[14]?.pressed) mx -= 1;
        if (pad.buttons[15]?.pressed) mx += 1;
      }
    }

    mx = Math.max(-1, Math.min(1, mx));
    my = Math.max(-1, Math.min(1, my));
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }

    let fire = this.has("Space") || this.pointerDown;
    let pauseHeld = this.has("Escape") || this.has("KeyP");
    let muteHeld = this.has("KeyM");
    if (pads) {
      for (const pad of pads) {
        if (!pad) continue;
        if (pad.buttons[0]?.pressed || (pad.buttons[7]?.value ?? 0) > 0.4) fire = true;
        if (pad.buttons[9]?.pressed) pauseHeld = true;
      }
    }

    const pause = pauseHeld && !this.prevPause;
    const mute = muteHeld && !this.prevMute;
    this.prevPause = pauseHeld;
    this.prevMute = muteHeld;

    return {
      moveX: mx,
      moveY: my,
      fire,
      pause,
      mute,
      pointer: this.pointerDown,
      pointerX: this.pointerX,
      pointerY: this.pointerY,
    };
  }

  destroy() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}
