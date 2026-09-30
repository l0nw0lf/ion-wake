import type { ShipId } from "./ships";
import type { BossForm } from "./waves";

export type SpriteBank = {
  player: HTMLImageElement[];
  scout: HTMLImageElement;
  fighter: HTMLImageElement;
  tank: HTMLImageElement;
  bomber: HTMLImageElement;
  bosses: Record<BossForm, HTMLImageElement[]>;
  explode: HTMLImageElement[];
  boltPlayer: HTMLImageElement[];
  boltEnemy: HTMLImageElement[];
  muzzle: HTMLImageElement[];
  pickupMulti: HTMLImageElement;
  pickupShield: HTMLImageElement;
  pickupSpeed: HTMLImageElement;
  pickupLife: HTMLImageElement;
  ships: Record<ShipId, HTMLImageElement[]>;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function all(srcs: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(srcs.map(loadImage));
}

export async function loadSprites(): Promise<SpriteBank> {
  const [
    player,
    explode,
    boltPlayer,
    boltEnemy,
    muzzle,
    scout,
    fighter,
    tank,
    bomber,
    dreadnought,
    reaper,
    hydra,
    sovereign,
    pickupMulti,
    pickupShield,
    pickupSpeed,
    pickupLife,
    ember,
    voidSkin,
    sol,
  ] = await Promise.all([
    all(["/sprites/player-1.png?v=cut", "/sprites/player-2.png?v=cut", "/sprites/player-3.png?v=cut", "/sprites/player-4.png?v=cut"]),
    all(["/sprites/explode-1.png", "/sprites/explode-2.png", "/sprites/explode-3.png", "/sprites/explode-4.png"]),
    all(["/sprites/bolt-player-1.png", "/sprites/bolt-player-2.png"]),
    all(["/sprites/bolt-enemy-1.png", "/sprites/bolt-enemy-2.png"]),
    all(["/sprites/muzzle-1.png", "/sprites/muzzle-2.png", "/sprites/muzzle-3.png", "/sprites/muzzle-4.png"]),
    loadImage("/sprites/enemy-scout.png"),
    loadImage("/sprites/enemy-fighter.png"),
    loadImage("/sprites/enemy-tank.png"),
    loadImage("/sprites/enemy-bomber.png"),
    all(["/sprites/enemy-boss.png?v=2", "/sprites/enemy-boss-2.png?v=2"]),
    all(["/sprites/enemy-boss-reaper.png?v=1", "/sprites/enemy-boss-reaper-2.png?v=1"]),
    all(["/sprites/enemy-boss-hydra.png?v=1", "/sprites/enemy-boss-hydra-2.png?v=1"]),
    all(["/sprites/enemy-boss-sovereign.png?v=1", "/sprites/enemy-boss-sovereign-2.png?v=1"]),
    loadImage("/sprites/pickup-multi.png"),
    loadImage("/sprites/pickup-shield.png"),
    loadImage("/sprites/pickup-speed.png"),
    loadImage("/sprites/pickup-life.png"),
    loadImage("/sprites/ships/ember.png?v=1"),
    loadImage("/sprites/ships/void.png?v=1"),
    loadImage("/sprites/ships/sol.png?v=1"),
  ]);

  return {
    player,
    explode,
    boltPlayer,
    boltEnemy,
    muzzle,
    scout,
    fighter,
    tank,
    bomber,
    bosses: {
      dreadnought,
      reaper,
      hydra,
      sovereign,
    },
    pickupMulti,
    pickupShield,
    pickupSpeed,
    pickupLife,
    ships: {
      ion: player,
      ember: [ember],
      void: [voidSkin],
      sol: [sol],
    },
  };
}
