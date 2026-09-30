export type EnemyKind = "scout" | "fighter" | "tank" | "bomber" | "boss";
export type Pattern = "sine" | "dive" | "hold" | "fall" | "boss";
export type BossForm = "dreadnought" | "reaper" | "hydra" | "sovereign";

export type Spawn = {
  kind: EnemyKind;
  x: number;
  delay: number;
  pattern: Pattern;
};

export const BOSS_ORDER: BossForm[] = ["dreadnought", "reaper", "hydra", "sovereign"];

export function isBossWave(n: number) {
  return n > 0 && n % 5 === 0;
}

export function bossTier(wave: number) {
  return Math.max(1, Math.floor(wave / 5));
}

export function bossForm(wave: number): BossForm {
  return BOSS_ORDER[(bossTier(wave) - 1) % BOSS_ORDER.length];
}

export function bossTitle(form: BossForm) {
  switch (form) {
    case "dreadnought":
      return "Dreadnought";
    case "reaper":
      return "Reaper";
    case "hydra":
      return "Hydra";
    case "sovereign":
      return "Sovereign";
    default: {
      const _exhaustive: never = form;
      return _exhaustive;
    }
  }
}

function pick(n: number, i: number): EnemyKind {
  if (n <= 1) return "scout";
  if (n === 2) return i % 4 === 0 ? "fighter" : "scout";
  if (n === 3) return i % 2 === 0 ? "fighter" : "scout";
  const roll = (i * 3 + n) % 10;
  if (roll > 8 && n > 4) return "tank";
  if (roll > 6 && n > 3) return "bomber";
  if (roll > 3 && n > 2) return "fighter";
  return "scout";
}

function row(n: number, count: number, delay: number, pattern: Pattern): Spawn[] {
  const items: Spawn[] = [];
  const c = Math.max(3, Math.min(7, count));
  for (let i = 0; i < c; i++) {
    items.push({
      kind: pick(n, i),
      x: (i + 1) / (c + 1),
      delay: delay + i * 0.07,
      pattern,
    });
  }
  return items;
}

function vee(n: number, delay: number): Spawn[] {
  const items: Spawn[] = [];
  const mid = 0.5;
  const arms = 3;
  items.push({ kind: pick(n, 0), x: mid, delay, pattern: "sine" });
  for (let i = 1; i <= arms; i++) {
    items.push({
      kind: pick(n, i),
      x: mid - i * 0.12,
      delay: delay + i * 0.12,
      pattern: "sine",
    });
    items.push({
      kind: pick(n, i + 3),
      x: mid + i * 0.12,
      delay: delay + i * 0.12,
      pattern: "sine",
    });
  }
  return items;
}

export function planWave(n: number): Spawn[] {
  if (isBossWave(n)) {
    const form = bossForm(n);
    const tier = bossTier(n);
    const spawns: Spawn[] = [{ kind: "boss", x: 0.5, delay: 0.02, pattern: "boss" }];
    if (form === "reaper") {
      spawns.push(
        { kind: "fighter", x: 0.18, delay: 1.1, pattern: "sine" },
        { kind: "fighter", x: 0.82, delay: 1.1, pattern: "sine" },
      );
    } else if (form === "sovereign") {
      spawns.push(
        { kind: "bomber", x: 0.22, delay: 0.8, pattern: "hold" },
        { kind: "bomber", x: 0.78, delay: 0.8, pattern: "hold" },
        { kind: "scout", x: 0.38, delay: 1.6, pattern: "dive" },
        { kind: "scout", x: 0.62, delay: 1.6, pattern: "dive" },
      );
    } else if (form === "dreadnought" && tier >= 5) {
      spawns.push(
        { kind: "tank", x: 0.24, delay: 1.2, pattern: "hold" },
        { kind: "tank", x: 0.76, delay: 1.2, pattern: "hold" },
      );
    }
    return spawns;
  }
  const style = n % 5;
  if (n === 1) return vee(1, 0.15);
  if (style === 1) return [...row(n, 5, 0.1, "sine"), ...row(n, 5, 0.9, "fall")];
  if (style === 2) return [...row(n, 6, 0.1, "hold"), ...row(n, 4, 1.4, "dive")];
  if (style === 3) return [...vee(n, 0.1), ...row(n, 4, 1.6, "dive")];
  if (style === 4) return [...row(n, 7, 0.05, "fall"), ...row(n, 3, 1.2, "hold")];
  const extra = n > 8 ? row(n, 4, 2.0, "dive") : [];
  return [...vee(n, 0.08), ...row(n, 5, 1.1, "sine"), ...extra];
}

export function enemyStats(kind: EnemyKind, wave: number) {
  const hpBonus = Math.floor((wave - 1) / 4);
  switch (kind) {
    case "scout":
      return { hp: 1 + hpBonus, r: 12, w: 30, h: 42, speed: 78, score: 100, fire: 1.8 };
    case "fighter":
      return { hp: 2 + hpBonus, r: 16, w: 42, h: 42, speed: 58, score: 250, fire: 1.35 };
    case "tank":
      return { hp: 6 + hpBonus * 2, r: 20, w: 50, h: 46, speed: 34, score: 500, fire: 1.9 };
    case "bomber":
      return { hp: 4 + hpBonus, r: 18, w: 52, h: 42, speed: 46, score: 400, fire: 1.15 };
    case "boss": {
      const form = bossForm(wave);
      const tier = bossTier(wave);
      const shape =
        form === "dreadnought"
          ? { r: 34, w: 148, h: 110, speed: 46 }
          : form === "reaper"
            ? { r: 28, w: 116, h: 112, speed: 88 }
            : form === "hydra"
              ? { r: 40, w: 176, h: 108, speed: 38 }
              : { r: 46, w: 196, h: 138, speed: 52 };
      return {
        hp: 80 + 48 * tier,
        ...shape,
        speed: shape.speed + (tier - 1) * 4,
        score: 5000 + 4200 * tier,
        fire: Math.max(0.28, 0.96 - 0.1 * tier),
      };
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
