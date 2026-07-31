"use client";

import { useEffect, useRef, useState } from "react";
import Board, { type CellMark } from "@/components/battleship/Board";
import Thinking from "@/components/Thinking";
import { cellKey, coordLabel, FLEET, type Ship, shipCells, shipKind } from "@/lib/games/battleship/rules";
import type { BattleshipView } from "@/lib/games/battleship/module";
import type { PlayerView } from "@/lib/server/games";

type Props = {
  /** Estado de la sala: de quién es el turno, si acabó la partida. */
  view: PlayerView;
  /** Estado del juego filtrado para este jugador. */
  game: BattleshipView;
  onFire: (x: number, y: number) => Promise<void>;
  thinking: boolean;
};

/** Vibra si el móvil lo permite. En iPhone no existe y no pasa nada. */
function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

function shipAt(ships: Ship[], x: number, y: number): Ship | undefined {
  const key = cellKey(x, y);
  return ships.find((s) => shipCells(s).some((c) => cellKey(c.x, c.y) === key));
}

function opponentMarks(game: BattleshipView): Record<string, CellMark> {
  const marks: Record<string, CellMark> = {};
  for (const shot of game.yourShots) {
    marks[cellKey(shot.x, shot.y)] = shot.hit ? "hit" : "miss";
  }
  // Al hundir un barco se revela entero.
  for (const ship of game.opponentSunk) {
    for (const c of shipCells(ship)) marks[cellKey(c.x, c.y)] = "sunk";
  }
  return marks;
}

function ownMarks(game: BattleshipView): Record<string, CellMark> {
  const marks: Record<string, CellMark> = {};
  for (const ship of game.yourShips) {
    for (const c of shipCells(ship)) marks[cellKey(c.x, c.y)] = "ship";
  }
  for (const shot of game.shotsAgainstYou) {
    marks[cellKey(shot.x, shot.y)] = shot.hit ? "hit" : "miss";
  }
  for (const ship of game.yourShips.filter((s) => game.yourSunk.includes(s.id))) {
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

export default function Play({ view, game, onFire, thinking }: Props) {
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const [firing, setFiring] = useState(false);

  const marks = opponentMarks(game);
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

  const lastShot = game.yourShots.at(-1);

  // Último ataque recibido. El tablero propio queda fuera de pantalla en el
  // móvil, así que el aviso sube aquí arriba en vez de quedarse abajo.
  const lastAgainstYou = game.shotsAgainstYou.at(-1);
  const shipStruck = lastAgainstYou?.hit
    ? shipAt(game.yourShips, lastAgainstYou.x, lastAgainstYou.y)
    : undefined;
  // Si el barco alcanzado ya está hundido, fue este disparo el que lo remató.
  const sankYourShip = shipStruck ? game.yourSunk.includes(shipStruck.id) : false;

  const receivedCount = game.shotsAgainstYou.length;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (lastAgainstYou?.hit) buzz(sankYourShip ? [90, 60, 90, 60, 160] : [70]);
    // `receivedCount` es la señal de «ha llegado un disparo nuevo».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivedCount]);

  // Aviso corto al recuperar el turno, por si dejaste el móvil en la mesa.
  const hadTurn = useRef(view.yourTurn);
  useEffect(() => {
    if (view.yourTurn && !hadTurn.current) buzz(45);
    hadTurn.current = view.yourTurn;
  }, [view.yourTurn]);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          "flex items-center justify-center rounded-xl px-4 py-3 text-center font-bold transition-colors",
          view.yourTurn ? "bg-emerald-400 text-sea-950" : "bg-sea-800 text-foam/70",
        ].join(" ")}
      >
        {view.yourTurn ? (
          "Tu turno — ¡dispara!"
        ) : (
          <>
            Turno del rival
            <Thinking active={thinking} />
          </>
        )}
      </div>

      {lastAgainstYou && (
        // La `key` cambia con cada disparo recibido, lo que reinicia la animación.
        <div
          key={receivedCount}
          className={[
            "rounded-xl px-4 py-3 text-center",
            // El fallo llevaba el mismo `bg-sea-800` que el cartel de turno de
            // aquí encima: dos cajas iguales seguidas y no se notaba que había
            // pasado nada. Tono agua y borde propio para que se distinga.
            lastAgainstYou.hit
              ? `animate-alert-hit ${sankYourShip ? "bg-sunk" : "bg-hit/85"} text-white`
              : "animate-alert bg-sea-500/25 text-foam ring-1 ring-sea-500/80",
          ].join(" ")}
        >
          <p className="font-bold">
            {sankYourShip
              ? `☠️ ¡Te han hundido el ${shipStruck && shipKind(shipStruck.id)?.name}!`
              : lastAgainstYou.hit
                ? `💥 ¡Tocado tu ${shipStruck && shipKind(shipStruck.id)?.name}!`
                : "💧 El rival ha fallado"}
          </p>
          <p className="text-sm opacity-80">
            Te dispararon a{" "}
            <span className="font-mono font-bold tracking-wider">
              {coordLabel(lastAgainstYou.x, lastAgainstYou.y)}
            </span>
            , marcado en tu flota
          </p>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foam/70">Tablero rival</h2>
        <Board
          marks={marks}
          selected={target}
          disabled={!view.yourTurn || firing}
          onCell={(x, y) => !alreadyShot(x, y) && setTarget({ x, y })}
        />
        <FleetStatus sunkIds={game.opponentSunk.map((s) => s.id)} title="Su flota:" />
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
          <Board
            marks={ownMarks(game)}
            highlight={lastAgainstYou ? { x: lastAgainstYou.x, y: lastAgainstYou.y } : null}
            compact
          />
        </div>
        <FleetStatus sunkIds={game.yourSunk} title="Tus barcos:" />
      </section>
    </div>
  );
}
