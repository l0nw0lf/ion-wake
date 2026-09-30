import { useEffect, useRef } from "react";
import { IonWakeGame } from "@/game/engine";
import { Overlays } from "./Overlays";

export function IonWake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<IonWakeGame | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new IonWakeGame(canvas);
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none select-none"
        aria-label="ION WAKE playfield"
      />
      <Overlays gameRef={gameRef} />
    </div>
  );
}
