"use client";

import { useState } from "react";
import Board, { type CellMark } from "@/components/Board";
import { cellKey, coordLabel, FLEET, shipCells } from "@/lib/battleship";
import type { PlayerView } from "@/lib/server/games";

type Props = {
  view: PlayerView;
  onFire: (x: number, y: number) => Promise<void>;
};

function opponentMarks(view: PlayerView): Record<string, CellMark> {
  const marks: Record<string, CellMark> = {};
  for (const shot of view.yourShots) {
    marks[cellKey(shot.x, shot.y)] = shot.hit ? "hit" : "miss";
  }
  // Al hundir un barco se revela entero.
  for (const ship of view.opponentSunk) {
    for (const c of shipCells(ship)) marks[cellKey(c.x, c.y)] = "sunk";
  }
  return marks;
}

function ownMarks(view: PlayerView): Record<string, CellMark> {
  const marks: Record<string, CellMark> = {};
  for (const ship of view.yourShips) {
    for (const c of shipCells(ship)) marks[cellKey(c.x, c.y)] = "ship";
  }
  for (const shot of view.shotsAgainstYou) {
    marks[cellKey(shot.x, shot.y)] = shot.hit ? "hit" : "miss";
  }
  for (const ship of view.yourShips.filter((s) => view.yourSunk.includes(s.id))) {
    for (const c of shipCells(ship)) marks[cellKey(c.x, c.y)] = "sunk";
  }
  return marks;
}

function FleetStatus({ sunkIds, title }: { sunkIds: string[]; title: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[0.7rem]">
      <span className="text-foam/50">{title}</span>
      {FLEET.map((kind) => {
        const sunk = sunkIds.includes(kind.id);
        return (
          <span
            key={kind.id}
            className={[
              "rounded px-1.5 py-0.5 ring-1",
              sunk
                ? "bg-sunk/60 text-foam/50 line-through ring-sunk"
                : "bg-sea-800/60 text-foam/80 ring-sea-700",
            ].join(" ")}
          >
            {kind.name}
          </span>
        );
      })}
    </div>
  );
}

export default function Play({ view, onFire }: Props) {
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const [firing, setFiring] = useState(false);

  const marks = opponentMarks(view);
  const alreadyShot = (x: number, y: number) => cellKey(x, y) in marks;

  const shoot = async () => {
    if (!target) return;
    setFiring(true);
    try {
      await onFire(target.x, target.y);
      setTarget(null);
    } finally {
      setFiring(false);
    }
  };

  const lastShot = view.yourShots.at(-1);
  const lastAgainstYou = view.shotsAgainstYou.at(-1);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          "rounded-xl px-4 py-3 text-center font-bold transition-colors",
          view.yourTurn ? "bg-emerald-400 text-sea-950" : "bg-sea-800 text-foam/70",
        ].join(" ")}
      >
        {view.yourTurn ? "Tu turno — ¡dispara!" : "Turno del rival…"}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foam/70">Tablero rival</h2>
        <Board
          marks={marks}
          selected={target}
          disabled={!view.yourTurn || firing}
          onCell={(x, y) => !alreadyShot(x, y) && setTarget({ x, y })}
        />
        <FleetStatus sunkIds={view.opponentSunk.map((s) => s.id)} title="Su flota:" />
        <button
          type="button"
          onClick={shoot}
          disabled={!target || !view.yourTurn || firing}
          className="rounded-xl bg-hit px-4 py-4 text-lg font-bold text-white disabled:bg-sea-800 disabled:text-foam/40 active:brightness-110"
        >
          {target ? `¡Fuego a ${coordLabel(target.x, target.y)}!` : "Elige una casilla"}
        </button>
        {lastShot && (
          <p className="text-center text-xs text-foam/60">
            Tu último disparo: {coordLabel(lastShot.x, lastShot.y)} →{" "}
            {lastShot.hit ? "¡tocado!" : "agua"}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-sea-700/60 pt-3">
        <h2 className="text-sm font-semibold text-foam/70">Tu flota</h2>
        {/* Más pequeño que el rival: sólo hay que consultarlo, no se toca. */}
        <div className="mx-auto w-4/5">
          <Board marks={ownMarks(view)} compact />
        </div>
        <FleetStatus sunkIds={view.yourSunk} title="Tus barcos:" />
        {lastAgainstYou && (
          <p className="text-center text-xs text-foam/60">
            Te dispararon a {coordLabel(lastAgainstYou.x, lastAgainstYou.y)} →{" "}
            {lastAgainstYou.hit ? "tocado" : "agua"}
          </p>
        )}
      </section>
    </div>
  );
}
