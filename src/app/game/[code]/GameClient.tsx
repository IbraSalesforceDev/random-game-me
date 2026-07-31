"use client";

import Link from "next/link";
import { useState } from "react";
import Placement from "@/components/battleship/Placement";
import Play from "@/components/battleship/Play";
import Checkers from "@/components/checkers/Checkers";
import Connect4 from "@/components/connect4/Connect4";
import Domino from "@/components/domino/Domino";
import GamePicker from "@/components/GamePicker";
import Scoreboard from "@/components/Scoreboard";
import TicTacToe from "@/components/tictactoe/TicTacToe";
import { chooseGame, requestRematch, sendMove } from "@/lib/client/session";
import { useGame } from "@/lib/client/useGame";
import type { BattleshipView } from "@/lib/games/battleship/module";
import type { Ship } from "@/lib/games/battleship/rules";
import type { CheckersView } from "@/lib/games/checkers/module";
import type { Connect4View } from "@/lib/games/connect4/module";
import type { DominoView } from "@/lib/games/domino/module";
import type { End, Tile } from "@/lib/games/domino/rules";
import type { TicTacToeView } from "@/lib/games/tictactoe/module";
import { BOT_LABEL } from "@/lib/games/types";
import type { PlayerView } from "@/lib/server/games";

function ShareCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    const text = `¡Échame un pique! Código: ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Piques", text, url });
        return;
      } catch {
        // El usuario canceló el diálogo: caemos al portapapeles.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-foam/70">Pásale este código a tu rival:</p>
      <p className="rounded-2xl bg-sea-800 px-8 py-4 font-mono text-5xl font-bold tracking-[0.2em] ring-1 ring-sea-500/50">
        {code}
      </p>
      <button
        type="button"
        onClick={share}
        className="rounded-xl bg-sea-700 px-6 py-3 font-semibold ring-1 ring-sea-500/50 active:brightness-110"
      >
        {copied ? "¡Enlace copiado!" : "Compartir enlace"}
      </button>
    </div>
  );
}

function Waiting({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="size-8 animate-spin rounded-full border-2 border-sea-500 border-t-transparent" />
      <p className="text-foam/70">{message}</p>
    </div>
  );
}

/** Reparte la partida en curso al componente del juego elegido. */
function ActiveGame({
  view,
  move,
  thinking,
}: {
  view: PlayerView;
  move: (m: unknown) => Promise<void>;
  /** El bot está a media tanda: lo avisan los carteles de turno. */
  thinking: boolean;
}) {
  if (view.game === "battleship") {
    const game = view.gameView as BattleshipView;
    if (game.phase === "placing") {
      return game.yourFleetReady ? (
        <Waiting message="Flota lista. Esperando a que el rival coloque la suya…" />
      ) : (
        <Placement onConfirm={(ships: Ship[]) => move({ type: "ships", ships })} />
      );
    }
    return (
      <Play
        view={view}
        game={game}
        thinking={thinking}
        onFire={(x, y) => move({ type: "fire", x, y })}
      />
    );
  }

  if (view.game === "connect4") {
    return (
      <Connect4
        view={view}
        game={view.gameView as Connect4View}
        thinking={thinking}
        onDrop={(col) => move({ type: "drop", col })}
      />
    );
  }

  if (view.game === "domino") {
    return (
      <Domino
        view={view}
        game={view.gameView as DominoView}
        thinking={thinking}
        onPlay={(tile: Tile, end: End) => move({ type: "play", tile, end })}
        onDraw={() => move({ type: "draw" })}
        onPass={() => move({ type: "pass" })}
      />
    );
  }

  if (view.game === "checkers") {
    return (
      <Checkers
        view={view}
        game={view.gameView as CheckersView}
        thinking={thinking}
        onMove={(from, to) => move({ type: "move", from, to })}
      />
    );
  }

  if (view.game === "tictactoe") {
    return (
      <TicTacToe
        view={view}
        game={view.gameView as TicTacToeView}
        thinking={thinking}
        onMark={(cell) => move({ type: "mark", cell })}
      />
    );
  }

  return <Waiting message="Preparando la partida…" />;
}

/**
 * Lo que el bot «tarda en pensar» su primera jugada. Va aparte de la pausa
 * entre encadenadas: cuando sólo contesta una vez —el tres en raya, el conecta
 * 4— no hay nada que seguir con la vista, y una respuesta demasiado pegada a
 * la tuya no llega a leerse como el turno del rival.
 */
const THINK_MS: Record<string, number> = {
  // En el dominó su jugada es una ficha que aparece en un extremo de la
  // cadena mientras tú miras tu mano, y encima hay un aviso que leer: necesita
  // algo más de aire que un tablero donde el cambio te salta a la vista.
  domino: 1300,
};
const DEFAULT_THINK_MS = 1000;
/**
 * Pausa entre jugadas encadenadas. En las damas una cadena de capturas es un
 * mismo movimiento seguido y ese ritmo va bien, pero en el hundir la flota
 * cada disparo extra es una decisión aparte: encadenados así parecían una
 * ráfaga y no un rival apuntando otra vez.
 */
const CHAIN_MS: Record<string, number> = { battleship: 1000, domino: 1000 };
const DEFAULT_CHAIN_MS = 620;
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

const OUTCOME = {
  won: { emoji: "🏆", title: "¡Has ganado!", box: "bg-emerald-400 text-sea-950" },
  lost: { emoji: "💥", title: "Has perdido", box: "bg-sunk text-foam" },
  draw: { emoji: "🤝", title: "Empate", box: "bg-sea-700 text-foam" },
} as const;

export default function GameClient({ code }: { code: string }) {
  const { view, setView, error, setError, ready, refresh, freeze } = useGame(code);
  const [notice, setNotice] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const guard = async (action: () => Promise<void>) => {
    try {
      await action();
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Algo ha fallado");
      // El servidor manda: recargamos el estado real tras un rechazo.
      void refresh();
    }
  };

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="text-2xl font-bold">Vaya…</h1>
        <p className="text-foam/70">{error}</p>
        <Link
          href="/"
          className="rounded-xl bg-sea-700 px-6 py-3 font-semibold ring-1 ring-sea-500/50"
          onClick={() => setError(null)}
        >
          Volver al inicio
        </Link>
      </main>
    );
  }

  if (!ready || !view) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
        <Waiting message="Entrando en la sala…" />
      </main>
    );
  }

  // El bot juega toda su tanda dentro de una petición, así que el servidor
  // devuelve el camino recorrido. Se enseña paso a paso: si no, una cadena de
  // capturas aparecería resuelta de golpe y no se vería lo que ha pasado.
  const move = (m: unknown) =>
    guard(async () => {
      const { view: final, replay } = await sendMove(code, m);

      if (replay.length <= 1) {
        setView(final);
        return;
      }

      const juego = view.game ?? "";
      const thinkMs = THINK_MS[juego] ?? DEFAULT_THINK_MS;
      const chainMs = CHAIN_MS[juego] ?? DEFAULT_CHAIN_MS;

      freeze(true);
      setThinking(true);
      try {
        for (const [i, step] of replay.entries()) {
          setView(step);
          // La pausa va entre jugadas, no después de la última: tu propia
          // jugada tiene que pintarse al momento.
          if (i < replay.length - 1) await sleep(i === 0 ? thinkMs : chainMs);
        }
      } finally {
        setThinking(false);
        freeze(false);
      }
      setView(final);
    });
  const outcome = view.outcome ? OUTCOME[view.outcome] : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2 text-sm text-foam/50">
        <Link href="/">← Salir</Link>
        <span className="truncate">{view.gameName}</span>
        <span className={view.botLevel ? "" : "font-mono tracking-widest"}>
          {view.botLevel ? `🤖 Bot · ${BOT_LABEL[view.botLevel]}` : `SALA ${view.code}`}
        </span>
      </header>

      {notice && (
        <p className="rounded-lg bg-amber-400/15 px-3 py-2 text-center text-sm text-amber-200 ring-1 ring-amber-400/30">
          {notice}
        </p>
      )}

      {view.status === "waiting" && <ShareCode code={view.code} />}

      {view.status === "choosing" && (
        <GamePicker
          scores={view.scores}
          soloOnly={view.botLevel !== null}
          onChoose={(id) => guard(async () => setView(await chooseGame(code, id)))}
        />
      )}

      {view.status === "playing" && <ActiveGame view={view} move={move} thinking={thinking} />}

      {view.status === "finished" && outcome && (
        <div className="flex flex-col gap-5">
          <div className={`rounded-2xl px-6 py-8 text-center ${outcome.box}`}>
            <p className="text-5xl">{outcome.emoji}</p>
            <h1 className="mt-2 text-3xl font-black">{outcome.title}</h1>
            <p className="mt-1 opacity-80">{view.gameName}</p>
          </div>

          <Scoreboard tally={view.game ? view.scores[view.game] : undefined} />

          {/* Las dos primeras se quedan en la sala; salir se separa y se avisa. */}
          <button
            type="button"
            onClick={() => guard(async () => setView(await requestRematch(code, true)))}
            className="rounded-xl bg-emerald-400 px-4 py-4 text-lg font-bold text-sea-950 active:brightness-110"
          >
            Revancha
            <span className="block text-sm font-medium opacity-70">
              Otra de {view.gameName?.toLowerCase()}
            </span>
          </button>
          <button
            type="button"
            onClick={() => guard(async () => setView(await requestRematch(code)))}
            className="rounded-xl bg-sea-700 px-4 py-4 text-lg font-bold ring-1 ring-sea-500/50 active:brightness-110"
          >
            Cambiar de juego
            <span className="block text-sm font-medium opacity-70">Volvéis a elegir</span>
          </button>

          <Link
            href="/"
            className="mt-2 text-center text-sm text-foam/45 underline decoration-foam/20 underline-offset-4"
          >
            {view.botLevel ? "Volver al inicio" : `Salir de la sala ${view.code}`}
          </Link>
        </div>
      )}
    </main>
  );
}
