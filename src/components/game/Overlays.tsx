import { Check, Pause, Shield, Volume2, VolumeX, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { IonWakeGame } from "@/game/engine";
import { SHIPS } from "@/game/ships";
import { useGameUi } from "@/game/store";
import { cn } from "@/lib/utils";

type Props = { gameRef: RefObject<IonWakeGame | null> };
type Ui = ReturnType<typeof useGame>;

function useGame() {
  return {
    mode: useGameUi((s) => s.mode),
    score: useGameUi((s) => s.score),
    lives: useGameUi((s) => s.lives),
    wave: useGameUi((s) => s.wave),
    combo: useGameUi((s) => s.combo),
    multi: useGameUi((s) => s.multi),
    shield: useGameUi((s) => s.shield),
    speed: useGameUi((s) => s.speed),
    ready: useGameUi((s) => s.ready),
    muted: useGameUi((s) => s.muted),
    waveLabel: useGameUi((s) => s.waveLabel),
    bossHp: useGameUi((s) => s.bossHp),
    bossHpMax: useGameUi((s) => s.bossHpMax),
    bossName: useGameUi((s) => s.bossName),
    scores: useGameUi((s) => s.scores),
    pendingScore: useGameUi((s) => s.pendingScore),
    pendingWave: useGameUi((s) => s.pendingWave),
    shipId: useGameUi((s) => s.shipId),
  };
}

export function Overlays({ gameRef }: Props) {
  const ui = useGame();
  const g = () => gameRef.current;

  return (
    <>
      {(ui.mode === "playing" || ui.mode === "paused") && (
        <Hud ui={ui} onPause={() => g()?.togglePause()} />
      )}
      {ui.mode === "title" && <Title ui={ui} game={g} />}
      {ui.mode === "hangar" && <Hangar ui={ui} game={g} />}
      {ui.mode === "help" && <Help onBack={() => g()?.closeOverlay()} />}
      {ui.mode === "scores" && <Scores ui={ui} onBack={() => g()?.closeOverlay()} />}
      {ui.mode === "paused" && <PauseMenu ui={ui} game={g} />}
      {ui.mode === "name" && <NameEntry ui={ui} game={g} />}
      {ui.mode === "gameover" && <GameOver ui={ui} game={g} />}
    </>
  );
}

function Hud({ ui, onPause }: { ui: Ui; onPause: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div>
        <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            Score
          </p>
          <p className="font-mono text-xl tabular-nums text-fg">{ui.score.toLocaleString()}</p>
          {ui.combo > 1 && (
            <p className="font-display text-xs tracking-widest text-muted">{ui.combo}x combo</p>
          )}
        </div>
        <div className="text-center">
          <p className="font-display text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            Wave
          </p>
          <p className="font-mono text-xl tabular-nums text-fg">{String(ui.wave).padStart(2, "0")}</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <p className="font-display text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
              Lives
            </p>
            <div className="mt-1 flex justify-end gap-1">
              {Array.from({ length: Math.max(ui.lives, 0) }).map((_, i) => (
                <span key={i} className="block size-2 rotate-45 bg-accent" />
              ))}
            </div>
          </div>
          <button
            type="button"
            data-ui
            onClick={onPause}
            className="pointer-events-auto flex size-11 items-center justify-center rounded-md border border-border bg-surface/80 text-fg"
            aria-label="Pause"
          >
            <Pause className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        </div>
        {ui.bossHpMax > 0 && (
          <div className="mx-auto mt-3 w-[min(20rem,72vw)]">
            <p className="text-center font-display text-[10px] font-medium uppercase tracking-[0.32em] text-danger">
              {ui.bossName || "Boss"}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border">
              <div
                className="h-full rounded-full bg-danger"
                style={{ width: `${Math.max(0, Math.min(100, (ui.bossHp / ui.bossHpMax) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex gap-2">
          {ui.multi > 1 && (
            <Chip icon={<Zap className="size-3.5" strokeWidth={1.75} />} label={`${ui.multi}-shot`} />
          )}
          {ui.shield > 0 && (
            <Chip icon={<Shield className="size-3.5" strokeWidth={1.75} />} label={`Shield ${ui.shield}`} />
          )}
          {ui.speed && <Chip label="Wake" />}
        </div>
        {ui.waveLabel && (
          <p className="font-display text-sm tracking-[0.28em] text-accent">{ui.waveLabel}</p>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface/80 px-2.5 py-1 font-display text-[11px] uppercase tracking-[0.16em] text-fg">
      {icon}
      {label}
    </span>
  );
}

function Panel({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 px-4 backdrop-blur-[2px]">
      <div
        data-ui
        className={cn(
          "w-full rounded-xl border border-border bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
          wide ? "max-w-md" : "max-w-sm",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Title({ ui, game }: { ui: Ui; game: () => IonWakeGame | null }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-xs uppercase tracking-[0.42em] text-muted">Deep sector</p>
      <h1 className="mt-3 font-display text-6xl font-semibold leading-none tracking-[0.08em] text-fg sm:text-7xl">
        ION
        <span className="block tracking-[0.18em]">WAKE</span>
      </h1>
      <p className="mt-5 max-w-xs text-sm text-muted">
        Break the waves. Unique bosses hold every fifth — each one meaner than the last.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" disabled={!ui.ready} onClick={() => game()?.startRun()}>
          {ui.ready ? "Engage" : "Aligning…"}
        </Button>
        <Button variant="outline" onClick={() => game()?.showHangar()}>
          Hangar
        </Button>
        <Button variant="outline" onClick={() => game()?.showScores()}>
          High scores
        </Button>
        <Button variant="ghost" onClick={() => game()?.showHelp()}>
          How to fly
        </Button>
      </div>
    </div>
  );
}

function Help({ onBack }: { onBack: () => void }) {
  return (
    <Panel>
      <h2 className="font-display text-2xl font-semibold tracking-wide">How to fly</h2>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        <li>WASD or arrows move. A is left, D is right.</li>
        <li>Drag or hold pointer to fly the ship.</li>
        <li>Cannons fire on their own. Space also fires.</li>
        <li>Esc or P pauses. M mutes.</li>
        <li>Pickups: multi-shot, shield, speed, extra life.</li>
        <li>Every fifth wave a unique boss holds the sector. Each one hits harder than the last.</li>
        <li>Hangar: same infinity hull, four wakes. Pick before you fly.</li>
      </ul>
      <Button className="mt-6 w-full" onClick={onBack}>
        Back
      </Button>
    </Panel>
  );
}

function Scores({ ui, onBack }: { ui: Ui; onBack: () => void }) {
  return (
    <Panel wide>
      <h2 className="font-display text-2xl font-semibold tracking-wide">High scores</h2>
      <p className="mt-1 text-sm text-muted">Local wakes only. This device.</p>
      <ol className="mt-5 space-y-2">
        {ui.scores.length === 0 && (
          <li className="rounded-md border border-border bg-surface-2 px-3 py-4 text-sm text-muted">
            No wakes recorded yet.
          </li>
        )}
        {ui.scores.map((row, i) => (
          <li
            key={`${row.name}-${row.at}`}
            className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2"
          >
            <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-display text-base tracking-[0.2em]">{row.name}</span>
            <span className="ml-auto font-mono text-sm tabular-nums">
              {row.score.toLocaleString()}
            </span>
            <span className="font-mono text-xs text-muted">W{row.wave}</span>
          </li>
        ))}
      </ol>
      <Button className="mt-6 w-full" onClick={onBack}>
        Back
      </Button>
    </Panel>
  );
}

function Hangar({ ui, game }: { ui: Ui; game: () => IonWakeGame | null }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center overflow-y-auto px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <p className="font-display text-xs uppercase tracking-[0.42em] text-muted">Bay 01</p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-wide">Hangar</h2>
      <p className="mt-2 max-w-xs text-center text-sm text-muted">
        Same infinity hull. Four different wakes.
      </p>
      <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
        {SHIPS.map((ship) => {
          const on = ui.shipId === ship.id;
          return (
            <button
              key={ship.id}
              type="button"
              data-ui
              onClick={() => game()?.setShip(ship.id)}
              className={cn(
                "relative flex min-h-36 flex-col items-center rounded-xl border px-3 py-4 text-center transition-colors",
                on ? "border-accent bg-surface" : "border-border bg-surface/80 hover:border-border-strong",
              )}
            >
              {on && (
                <span className="absolute right-2 top-2 text-accent">
                  <Check className="size-4" strokeWidth={2} />
                </span>
              )}
              <img
                src={ship.preview}
                alt=""
                className="h-16 w-28 object-contain"
                draggable={false}
              />
              <p className="mt-3 font-display text-sm tracking-[0.18em] text-fg">{ship.name}</p>
              <p className="mt-1 text-xs text-muted">{ship.blurb}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" disabled={!ui.ready} onClick={() => game()?.startRun()}>
          Fly {SHIPS.find((s) => s.id === ui.shipId)?.name ?? "Ion"}
        </Button>
        <Button variant="ghost" onClick={() => game()?.closeOverlay()}>
          Back
        </Button>
      </div>
    </div>
  );
}

function PauseMenu({ ui, game }: { ui: Ui; game: () => IonWakeGame | null }) {
  return (
    <Panel>
      <h2 className="font-display text-2xl font-semibold tracking-wide">Paused</h2>
      <p className="mt-1 text-sm text-muted">
        Wave {String(ui.wave).padStart(2, "0")} · {ui.score.toLocaleString()}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Button onClick={() => game()?.resume()}>Resume</Button>
        <Button variant="outline" onClick={() => game()?.toggleMute()} className="justify-center">
          {ui.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          {ui.muted ? "Sound off" : "Sound on"}
        </Button>
        <Button variant="ghost" onClick={() => game()?.quitToTitle()}>
          Quit to title
        </Button>
      </div>
    </Panel>
  );
}

function GameOver({ ui, game }: { ui: Ui; game: () => IonWakeGame | null }) {
  return (
    <Panel>
      <p className="font-display text-xs uppercase tracking-[0.32em] text-muted">Line broken</p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-wide">Game over</h2>
      <p className="mt-3 font-mono text-2xl tabular-nums">{ui.score.toLocaleString()}</p>
      <p className="text-sm text-muted">Wave {String(ui.wave).padStart(2, "0")}</p>
      <div className="mt-6 flex flex-col gap-3">
        <Button onClick={() => game()?.startRun()}>Fly again</Button>
        <Button variant="outline" onClick={() => game()?.showScores()}>
          High scores
        </Button>
        <Button variant="ghost" onClick={() => game()?.quitToTitle()}>
          Title
        </Button>
      </div>
    </Panel>
  );
}

function NameEntry({ ui, game }: { ui: Ui; game: () => IonWakeGame | null }) {
  const [letters, setLetters] = useState(["A", "A", "A"]);
  const [slot, setSlot] = useState(0);
  const lettersRef = useRef(letters);
  const slotRef = useRef(0);
  lettersRef.current = letters;
  slotRef.current = slot;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key)) {
        setLetters((prev) => {
          const next = [...prev];
          next[slotRef.current] = e.key.toUpperCase();
          return next;
        });
        setSlot((s) => Math.min(2, s + 1));
      } else if (e.key === "Backspace") {
        setSlot((s) => Math.max(0, s - 1));
      } else if (e.key === "ArrowLeft") setSlot((s) => Math.max(0, s - 1));
      else if (e.key === "ArrowRight") setSlot((s) => Math.min(2, s + 1));
      else if (e.key === "Enter") game()?.submitName(lettersRef.current.join(""));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);

  const cycle = (i: number, dir: number) => {
    setLetters((prev) => {
      const next = [...prev];
      const code = next[i].charCodeAt(0) - 65;
      next[i] = String.fromCharCode(((code + dir + 26) % 26) + 65);
      return next;
    });
    setSlot(i);
  };

  return (
    <Panel>
      <p className="font-display text-xs uppercase tracking-[0.32em] text-muted">New wake</p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-wide">Call sign</h2>
      <p className="mt-1 text-sm text-muted">
        {ui.pendingScore.toLocaleString()} · wave {String(ui.pendingWave).padStart(2, "0")}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {letters.map((ch, i) => (
          <button
            key={i}
            type="button"
            data-ui
            onClick={() => cycle(i, 1)}
            onContextMenu={(e) => {
              e.preventDefault();
              cycle(i, -1);
            }}
            className={cn(
              "flex size-14 items-center justify-center rounded-md border font-display text-3xl",
              i === slot ? "border-accent bg-surface-2 text-fg" : "border-border text-muted",
            )}
          >
            {ch}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-subtle">Tap a letter to cycle. Type to enter.</p>
      <div className="mt-6 flex flex-col gap-3">
        <Button onClick={() => game()?.submitName(letters.join(""))}>Save score</Button>
        <Button variant="ghost" onClick={() => game()?.skipName()}>
          Skip
        </Button>
      </div>
    </Panel>
  );
}
