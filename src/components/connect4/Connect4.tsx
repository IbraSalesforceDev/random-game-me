"use client";

import { useEffect, useRef } from "react";
import Thinking from "@/components/Thinking";
import type { Connect4View } from "@/lib/games/connect4/module";
import { COLUMNS, dropRow, ROWS } from "@/lib/games/connect4/rules";
import type { PlayerView } from "@/lib/server/games";
import type { Side } from "@/lib/games/types";

type Props = {
  view: PlayerView;
  game: Connect4View;
  onDrop: (col: number) => Promise<void>;
  thinking: boolean;
};

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

const DISC: Record<Side, string> = {
  host: "bg-amber-400",
  guest: "bg-rose-500",
};

export default function Connect4({ view, game, onDrop, thinking }: Props) {
  const you = view.you;
  const rival: Side = you === "host" ? "guest" : "host";
  const winning = new Set((game.winningLine ?? []).map((c) => `${c.col},${c.row}`));

  // Aviso al recuperar el turno, por si dejaste el móvil en la mesa.
  const hadTurn = useRef(view.yourTurn);
  useEffect(() => {
    if (view.yourTurn && !hadTurn.current) buzz(45);
    hadTurn.current = view.yourTurn;
  }, [view.yourTurn]);

  const playable = view.yourTurn && view.status === "playing";

  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          "flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-colors",
          view.yourTurn ? "bg-emerald-400 text-sea-950" : "bg-sea-800 text-foam/70",
        ].join(" ")}
      >
        <span className={`size-4 rounded-full ${DISC[view.yourTurn ? you : rival]}`} />
        {view.yourTurn ? (
          "Tu turno — suelta ficha"
        ) : (
          <>
            Turno del rival
            <Thinking active={thinking} />
          </>
        )}
      </div>

      <div className="rounded-2xl bg-sea-700/60 p-2 ring-1 ring-sea-500/40">
        {/* Una columna entera es un botón: en el móvil no hay que afinar. */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: COLUMNS }, (_, col) => {
            const full = dropRow(game.grid, col) === -1;
            return (
              <button
                key={col}
                type="button"
                disabled={!playable || full}
                onClick={() => onDrop(col)}
                aria-label={`Columna ${col + 1}`}
                className="flex flex-col-reverse gap-1 rounded-lg p-0.5 enabled:active:bg-foam/10 disabled:cursor-default"
              >
                {Array.from({ length: ROWS }, (_, row) => {
                  const cell = game.grid[col][row];
                  const isWinning = winning.has(`${col},${row}`);
                  const isLast = game.lastDrop?.col === col && game.lastDrop?.row === row;
                  return (
                    <span
                      key={row}
                      className={[
                        "relative aspect-square w-full rounded-full transition-colors",
                        cell ? DISC[cell] : "bg-sea-950/70",
                        isWinning ? "ring-2 ring-foam" : "",
                      ].join(" ")}
                    >
                      {/* Aro sobre la última ficha soltada: con el tablero a
                          medias, saber que ha caído una no basta para ver dónde. */}
                      {isLast && !isWinning && (
                        <span className="animate-last-move pointer-events-none absolute -inset-0.5 rounded-full border-2 border-foam" />
                      )}
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-5 text-sm text-foam/60">
        <span className="flex items-center gap-2">
          <span className={`size-3 rounded-full ${DISC[you]}`} />
          Tú
        </span>
        <span className="flex items-center gap-2">
          <span className={`size-3 rounded-full ${DISC[rival]}`} />
          Rival
        </span>
      </div>
    </div>
  );
}
