"use client";

import { useEffect, useRef } from "react";
import Thinking from "@/components/Thinking";
import type { TicTacToeView } from "@/lib/games/tictactoe/module";
import { cellLabel, CELLS } from "@/lib/games/tictactoe/rules";
import type { Side } from "@/lib/games/types";
import type { PlayerView } from "@/lib/server/games";

type Props = {
  view: PlayerView;
  game: TicTacToeView;
  onMark: (cell: number) => Promise<void>;
  thinking: boolean;
};

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

const MARK: Record<Side, string> = { host: "✕", guest: "◯" };
const MARK_COLOR: Record<Side, string> = { host: "text-amber-300", guest: "text-rose-400" };

export default function TicTacToe({ view, game, onMark, thinking }: Props) {
  const you = view.you;
  const rival: Side = you === "host" ? "guest" : "host";
  const winning = new Set(game.winningLine ?? []);

  // Aviso al recuperar el turno, por si dejaste el móvil en la mesa.
  const hadTurn = useRef(view.yourTurn);
  useEffect(() => {
    if (view.yourTurn && !hadTurn.current) buzz(45);
    hadTurn.current = view.yourTurn;
  }, [view.yourTurn]);

  const playable = view.yourTurn && view.status === "playing";

  return (
    <div className="flex flex-col gap-4">
      <div
        className={[
          "flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-colors",
          view.yourTurn ? "bg-emerald-400 text-sea-950" : "bg-sea-800 text-foam/70",
        ].join(" ")}
      >
        <span className="text-xl leading-none">{MARK[view.yourTurn ? you : rival]}</span>
        {view.yourTurn ? (
          "Tu turno"
        ) : (
          <>
            Turno del rival
            <Thinking active={thinking} />
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-sea-700/60 p-2 ring-1 ring-sea-500/40">
        {Array.from({ length: CELLS }, (_, i) => {
          const owner = game.cells[i];
          return (
            <button
              key={i}
              type="button"
              disabled={!playable || Boolean(owner)}
              onClick={() => onMark(i)}
              aria-label={cellLabel(i)}
              className={[
                "relative grid aspect-square place-items-center rounded-xl text-5xl font-black transition-colors",
                owner ? MARK_COLOR[owner] : "text-transparent",
                winning.has(i) ? "bg-emerald-400/25 ring-2 ring-emerald-300" : "bg-sea-950/70",
                playable && !owner ? "active:bg-sea-800" : "",
              ].join(" ")}
            >
              {owner ? MARK[owner] : "·"}
              {/* Recuadro sobre la última jugada: en un tablero medio lleno
                  no basta con que aparezca una ficha, hay que ver cuál. */}
              {game.lastMove === i && !winning.has(i) && (
                <span className="animate-last-move pointer-events-none absolute inset-0 rounded-xl border-2 border-foam/80" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-6 text-sm text-foam/60">
        <span className="flex items-center gap-2">
          <span className={`text-lg leading-none ${MARK_COLOR[you]}`}>{MARK[you]}</span>
          Tú
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-lg leading-none ${MARK_COLOR[rival]}`}>{MARK[rival]}</span>
          Rival
        </span>
      </div>
    </div>
  );
}
