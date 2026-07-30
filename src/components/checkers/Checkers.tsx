"use client";

import { useEffect, useRef, useState } from "react";
import type { CheckersView } from "@/lib/games/checkers/module";
import {
  CELLS,
  cellLabel,
  isPlayable,
  legalMoves,
  type Move,
  SIZE,
} from "@/lib/games/checkers/rules";
import type { Side } from "@/lib/games/types";
import type { PlayerView } from "@/lib/server/games";

type Props = {
  view: PlayerView;
  game: CheckersView;
  onMove: (from: number, to: number) => Promise<void>;
};

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

/**
 * Blancas para quien abre y negras para el rival, como manda la tradición.
 * Las negras llevan borde propio porque el tablero ya es oscuro y si no se
 * pierden contra las casillas.
 */
const PIECE: Record<Side, { fill: string; ring: string; dot: string }> = {
  host: {
    fill: "bg-slate-100 text-sea-950",
    ring: "ring-1 ring-slate-400/50",
    dot: "bg-slate-100",
  },
  guest: {
    fill: "bg-slate-950 text-slate-100",
    ring: "ring-1 ring-slate-400/70",
    dot: "bg-slate-950 ring-1 ring-slate-400/70",
  },
};

export default function Checkers({ view, game, onMove }: Props) {
  const you = view.you;
  const rival: Side = you === "host" ? "guest" : "host";
  const [selected, setSelected] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const playable = view.yourTurn && view.status === "playing" && !sending;
  const moves: Move[] = playable ? legalMoves(game.board, you, game.chainFrom) : [];
  const mustCapture = moves.some((m) => m.captured.length > 0);

  // Con una cadena en curso la pieza obligada ya viene elegida.
  const active = game.chainFrom ?? selected;
  const targets = new Map(moves.filter((m) => m.from === active).map((m) => [m.to, m]));
  const origins = new Set(moves.map((m) => m.from));

  const hadTurn = useRef(view.yourTurn);
  useEffect(() => {
    if (view.yourTurn && !hadTurn.current) buzz(45);
    hadTurn.current = view.yourTurn;
  }, [view.yourTurn]);

  // Cada vez que la partida avanza de verdad se olvida la selección: si no,
  // seguiría resaltada la casilla de la que ya salió la pieza. Durante una
  // cadena no importa, porque la pieza obligada viene en `chainFrom`.
  useEffect(() => {
    setSelected(null);
  }, [view.updatedAt]);

  const tap = async (i: number) => {
    if (!playable) return;

    if (targets.has(i) && active !== null) {
      setSending(true);
      try {
        if (targets.get(i)!.captured.length > 0) buzz(60);
        await onMove(active, i);
      } finally {
        setSending(false);
      }
      return;
    }
    // La cadena obliga a seguir con la misma pieza: no se puede cambiar.
    if (game.chainFrom === null && origins.has(i)) setSelected(i === selected ? null : i);
  };

  // Cada jugador ve sus piezas abajo, así que el invitado mira el tablero girado.
  const order = [...Array(CELLS).keys()];
  const cells = you === "host" ? order : order.reverse();

  const captured = {
    you: 12 - game.board.filter((p) => p?.side === you).length,
    rival: 12 - game.board.filter((p) => p?.side === rival).length,
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-center font-bold transition-colors",
          view.yourTurn ? "bg-emerald-400 text-sea-950" : "bg-sea-800 text-foam/70",
        ].join(" ")}
      >
        <span className={`size-4 rounded-full ${PIECE[view.yourTurn ? you : rival].dot}`} />
        {view.yourTurn
          ? game.chainFrom !== null
            ? "¡Sigue comiendo!"
            : mustCapture
              ? "Tu turno — comer es obligatorio"
              : "Tu turno"
          : "Turno del rival…"}
      </div>

      <div className="grid grid-cols-8 gap-0 overflow-hidden rounded-xl ring-1 ring-sea-500/40">
        {cells.map((i) => {
          const piece = game.board[i];
          const dark = isPlayable(i);
          const isTarget = targets.has(i);
          const isActive = active === i;
          const isOrigin = origins.has(i) && game.chainFrom === null;
          const movedTo = game.lastMove?.to === i;

          return (
            <button
              key={i}
              type="button"
              disabled={!playable || (!isTarget && !isOrigin)}
              onClick={() => tap(i)}
              aria-label={cellLabel(i)}
              className={[
                "relative grid aspect-square place-items-center transition-colors",
                // Una sola clase de fondo: si se acumulan, en Tailwind gana la
                // que salga después en la hoja de estilos, no en el atributo.
                isActive
                  ? "bg-emerald-500/45"
                  : movedTo
                    ? "bg-sea-500/35"
                    : dark
                      ? "bg-sea-900"
                      : "bg-sea-700/50",
              ].join(" ")}
            >
              {piece && (
                <span
                  className={[
                    "grid size-[78%] place-items-center rounded-full text-sm font-black shadow-md",
                    PIECE[piece.side].fill,
                    // Un único anillo: una pieza seleccionada también es origen,
                    // y dos clases `ring-*` se pisarían según el orden del CSS.
                    isActive
                      ? "ring-2 ring-emerald-200"
                      : isOrigin
                        ? "ring-2 ring-emerald-300/80"
                        : PIECE[piece.side].ring,
                  ].join(" ")}
                >
                  {piece.king ? "♛" : ""}
                </span>
              )}
              {isTarget && !piece && (
                <span
                  className={[
                    "size-1/3 rounded-full",
                    targets.get(i)!.captured.length > 0 ? "bg-hit" : "bg-emerald-300/80",
                  ].join(" ")}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-5 text-sm text-foam/60">
        <span className="flex items-center gap-2">
          <span className={`size-3 rounded-full ${PIECE[you].dot}`} />
          Tú
          <span className="tabular-nums opacity-60">({12 - captured.you})</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={`size-3 rounded-full ${PIECE[rival].dot}`} />
          Rival
          <span className="tabular-nums opacity-60">({12 - captured.rival})</span>
        </span>
      </div>

      {playable && (
        <p className="text-center text-xs text-foam/40">
          {active === null
            ? "Toca una de tus piezas resaltadas."
            : "Los puntos marcan dónde puede ir; los rojos son capturas."}
        </p>
      )}
      <p className="sr-only">{SIZE * SIZE} casillas</p>
    </div>
  );
}
