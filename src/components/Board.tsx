"use client";

import { BOARD_SIZE, cellKey, COLUMN_LABELS } from "@/lib/battleship";

export type CellMark = "empty" | "ship" | "hit" | "miss" | "sunk" | "preview" | "invalid";

const MARK_CLASS: Record<CellMark, string> = {
  empty: "bg-sea-800/70",
  ship: "bg-slate-300",
  hit: "bg-hit",
  sunk: "bg-sunk",
  miss: "bg-sea-950/80",
  preview: "bg-emerald-400/70",
  invalid: "bg-red-500/40",
};

type Props = {
  /** Mapa "x,y" -> estado de la casilla. Lo que no aparezca es agua sin tocar. */
  marks: Record<string, CellMark>;
  onCell?: (x: number, y: number) => void;
  selected?: { x: number; y: number } | null;
  disabled?: boolean;
  /** Versión pequeña, para el tablero propio durante la partida. */
  compact?: boolean;
};

export default function Board({ marks, onCell, selected, disabled, compact }: Props) {
  const cells: React.ReactNode[] = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const key = cellKey(x, y);
      const mark = marks[key] ?? "empty";
      const isSelected = selected?.x === x && selected?.y === y;

      cells.push(
        <button
          key={key}
          type="button"
          disabled={disabled || !onCell}
          onClick={() => onCell?.(x, y)}
          aria-label={`${COLUMN_LABELS[x]}${y + 1}`}
          className={[
            "relative aspect-square rounded-[2px] transition-colors",
            MARK_CLASS[mark],
            isSelected ? "ring-2 ring-amber-300 ring-inset z-10" : "",
            !disabled && onCell ? "active:brightness-125" : "",
          ].join(" ")}
        >
          {mark === "miss" && (
            <span className="animate-splash absolute inset-0 m-auto size-1/3 rounded-full bg-miss" />
          )}
          {(mark === "hit" || mark === "sunk") && (
            <span className="animate-splash absolute inset-0 grid place-items-center text-[0.6em] leading-none">
              {mark === "sunk" ? "☠" : "✕"}
            </span>
          )}
        </button>,
      );
    }
  }

  const labelClass = "grid place-items-center text-[0.55rem] font-medium text-foam/45";

  return (
    <div
      className={[
        "grid gap-[2px] rounded-lg bg-sea-900/60 p-1 ring-1 ring-sea-700/60 select-none",
        compact ? "text-xs" : "text-base",
      ].join(" ")}
      style={{ gridTemplateColumns: `1.1rem repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
    >
      <div />
      {COLUMN_LABELS.map((letter) => (
        <div key={letter} className={labelClass}>
          {letter}
        </div>
      ))}

      {Array.from({ length: BOARD_SIZE }, (_, y) => (
        <div key={`row-${y}`} className="contents">
          <div className={labelClass}>{y + 1}</div>
          {cells.slice(y * BOARD_SIZE, (y + 1) * BOARD_SIZE)}
        </div>
      ))}
    </div>
  );
}
