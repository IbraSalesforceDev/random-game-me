"use client";

import { useEffect, useState } from "react";
import Board, { type CellMark } from "@/components/Board";
import {
  canPlace,
  cellKey,
  FLEET,
  randomFleet,
  type Ship,
  shipCells,
  shipFootprint,
} from "@/lib/battleship";

type Props = {
  onConfirm: (ships: Ship[]) => Promise<void>;
};

export default function Placement({ onConfirm }: Props) {
  // Se genera en el cliente para que servidor y navegador no rendericen flotas distintas.
  const [ships, setShips] = useState<Ship[] | null>(null);
  const [selectedId, setSelectedId] = useState(FLEET[0].id);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => setShips(randomFleet()), []);

  if (!ships) {
    return <p className="py-10 text-center text-foam/60">Preparando el tablero…</p>;
  }

  const selected = ships.find((s) => s.id === selectedId)!;

  const flashInvalid = (cells: string[]) => {
    setInvalid(cells);
    window.setTimeout(() => setInvalid([]), 350);
  };

  const move = (next: Ship) => {
    if (canPlace(next, ships)) {
      setShips(ships.map((s) => (s.id === next.id ? next : s)));
    } else {
      flashInvalid(shipCells(next).map((c) => cellKey(c.x, c.y)));
    }
  };

  const marks: Record<string, CellMark> = {};
  // Zona vetada para el barco seleccionado: los demás barcos más su anillo de
  // agua. Se pinta primero y los barcos van encima.
  for (const ship of ships) {
    if (ship.id === selectedId) continue;
    for (const key of shipFootprint(ship)) marks[key] = "halo";
  }
  for (const ship of ships) {
    for (const c of shipCells(ship)) {
      marks[cellKey(c.x, c.y)] = ship.id === selectedId ? "preview" : "ship";
    }
  }
  for (const key of invalid) marks[key] = "invalid";

  const confirm = async () => {
    setSending(true);
    try {
      await onConfirm(ships);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-foam/70">
        Elige un barco y toca el tablero para moverlo. Cuando te guste, confirma.
      </p>
      <p className="text-center text-xs text-foam/45">
        Los barcos no pueden tocarse, ni siquiera por las esquinas. Lo sombreado
        es donde no cabe el barco que tienes elegido.
      </p>

      <Board marks={marks} onCell={(x, y) => move({ ...selected, x, y })} />

      <div className="flex flex-wrap gap-2">
        {FLEET.map((kind) => (
          <button
            key={kind.id}
            type="button"
            onClick={() => setSelectedId(kind.id)}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-colors",
              kind.id === selectedId
                ? "bg-emerald-400 text-sea-950 ring-emerald-300"
                : "bg-sea-800/70 text-foam/80 ring-sea-700",
            ].join(" ")}
          >
            {kind.name} <span className="opacity-60">{kind.size}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => move({ ...selected, horizontal: !selected.horizontal })}
          className="rounded-xl bg-sea-700 px-4 py-3 font-semibold ring-1 ring-sea-500/50 active:brightness-110"
        >
          ↻ Girar
        </button>
        <button
          type="button"
          onClick={() => setShips(randomFleet())}
          className="rounded-xl bg-sea-700 px-4 py-3 font-semibold ring-1 ring-sea-500/50 active:brightness-110"
        >
          🎲 Aleatorio
        </button>
      </div>

      <button
        type="button"
        onClick={confirm}
        disabled={sending}
        className="rounded-xl bg-emerald-400 px-4 py-4 text-lg font-bold text-sea-950 disabled:opacity-50 active:brightness-110"
      >
        {sending ? "Enviando…" : "Confirmar flota"}
      </button>
    </div>
  );
}
