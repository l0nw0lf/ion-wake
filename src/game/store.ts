import { create } from "zustand";
import type { ScoreEntry } from "./scores";
import type { ShipId } from "./ships";

export type GameMode =
  | "title"
  | "playing"
  | "paused"
  | "gameover"
  | "scores"
  | "name"
  | "help"
  | "hangar";

export type HudSnapshot = {
  mode: GameMode;
  score: number;
  lives: number;
  wave: number;
  combo: number;
  multi: number;
  shield: number;
  speed: boolean;
  ready: boolean;
  muted: boolean;
  waveLabel: string;
  bossHp: number;
  bossHpMax: number;
  bossName: string;
  scores: ScoreEntry[];
  pendingScore: number;
  pendingWave: number;
  shipId: ShipId;
};

const initial: HudSnapshot = {
  mode: "title",
  score: 0,
  lives: 3,
  wave: 1,
  combo: 0,
  multi: 1,
  shield: 0,
  speed: false,
  ready: false,
  muted: false,
  waveLabel: "",
  bossHp: 0,
  bossHpMax: 0,
  bossName: "",
  scores: [],
  pendingScore: 0,
  pendingWave: 1,
  shipId: "ion",
};

export const useGameUi = create<HudSnapshot>(() => ({ ...initial }));

export function patchHud(partial: Partial<HudSnapshot>) {
  useGameUi.setState(partial);
}

export function resetHud() {
  const { muted, ready, scores, shipId } = useGameUi.getState();
  useGameUi.setState({ ...initial, muted, ready, scores, shipId });
}
