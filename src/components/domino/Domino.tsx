"use client";

import { useEffect, useRef, useState } from "react";
import Thinking from "@/components/Thinking";
import type { DominoView } from "@/lib/games/domino/module";
import { type End, sameTile, type Tile } from "@/lib/games/domino/rules";
import type { PlayerView } from "@/lib/server/games";

type Props = {
  view: PlayerView;
  game: DominoView;
  onPlay: (tile: Tile, end: End) => Promise<void>;
  onDraw: () => Promise<void>;
  onPass: () => Promise<void>;
  thinking: boolean;
};

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

/** Medidas de una ficha tumbada, en píxeles, para calcular el plegado. */
const TILE_W = 72;
const GAP = 4;

/** Posiciones de los puntos en una rejilla de 3×3, como en una ficha real. */
const DOTS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Half({ n }: { n: number }) {
  return (
    <span className="grid size-full grid-cols-3 grid-rows-3 gap-px p-[14%]">
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={DOTS[n].includes(i) ? "size-full rounded-full bg-sea-950" : ""}
        />
      ))}
    </span>
  );
}

/** Una ficha. En la mano se ve de pie y en la cadena tumbada. */
function TileView({
  tile,
  upright,
  marked,
  label,
  className = "",
}: {
  tile: Tile;
  upright?: boolean;
  /** Última colocada: parpadea para que se vea llegar. */
  marked?: boolean;
  /** Para poder identificarla desde fuera; las de la mano ya van en su botón. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      aria-label={label}
      className={[
        "relative flex shrink-0 rounded-md bg-slate-100 shadow-sm",
        upright ? "h-[4.4rem] w-[2.2rem] flex-col" : "h-9 w-[4.5rem] flex-row",
        className,
      ].join(" ")}
    >
      <span className="aspect-square w-full flex-1">
        <Half n={tile[0]} />
      </span>
      <span className={upright ? "h-px w-full bg-slate-400/70" : "h-full w-px bg-slate-400/70"} />
      <span className="aspect-square w-full flex-1">
        <Half n={tile[1]} />
      </span>
      {marked && (
        <span className="animate-last-move pointer-events-none absolute -inset-0.5 rounded-md border-2 border-foam" />
      )}
    </span>
  );
}

export default function Domino({ view, game, onPlay, onDraw, onPass, thinking }: Props) {
  const [selected, setSelected] = useState<Tile | null>(null);
  const [sending, setSending] = useState(false);
  const [perRow, setPerRow] = useState(5);
  const chainRef = useRef<HTMLDivElement>(null);

  const playable = view.yourTurn && view.status === "playing" && !sending;

  /** Puntas por las que se puede colocar una ficha concreta. */
  const endsFor = (tile: Tile): End[] =>
    game.plays.filter((p) => sameTile(p.tile, tile)).map((p) => p.end);

  const hasPlay = game.plays.length > 0;
  const mustDraw = playable && !hasPlay && game.poolCount > 0;
  const mustPass = playable && !hasPlay && game.poolCount === 0;

  const hadTurn = useRef(view.yourTurn);
  useEffect(() => {
    if (view.yourTurn && !hadTurn.current) buzz(45);
    hadTurn.current = view.yourTurn;
  }, [view.yourTurn]);

  // Al avanzar la partida se olvida la ficha elegida: si no, seguiría marcada
  // una que ya se ha colocado.
  useEffect(() => setSelected(null), [view.updatedAt]);

  // Cuántas fichas caben por fila. Se mide en vez de fijarlo para que la
  // cadena se pliegue bien en cualquier ancho de pantalla.
  useEffect(() => {
    const el = chainRef.current;
    if (!el) return;
    const medir = () => {
      // `clientWidth` incluye el relleno de la caja: sin descontarlo salen
      // fichas de más por fila y la cadena se sale por la derecha.
      const css = getComputedStyle(el);
      const util = el.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      setPerRow(Math.max(2, Math.floor((util + GAP) / (TILE_W + GAP))));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const send = async (fn: () => Promise<void>) => {
    setSending(true);
    try {
      await fn();
    } finally {
      setSending(false);
    }
  };

  const tap = (tile: Tile) => {
    if (!playable) return;
    const opciones = endsFor(tile);
    if (opciones.length === 0) return;
    // Con una sola punta posible no hay nada que preguntar.
    if (opciones.length === 1) {
      buzz(35);
      setSelected(null);
      void send(() => onPlay(tile, opciones[0]));
      return;
    }
    setSelected((prev) => (prev && sameTile(prev, tile) ? null : tile));
  };

  const lastIndex =
    game.lastPlay === null ? -1 : game.lastPlay.end === "left" ? 0 : game.chain.length - 1;

  // La cadena se parte en filas y las impares van al revés, que es como se
  // dobla en una mesa. En recto, catorce fichas ocupan más de mil píxeles y en
  // el móvil se ven trescientos ochenta: no se podían mirar las dos puntas a
  // la vez, y las dos puntas son justo lo que hay que saber para decidir.
  const filas: { desde: number; fichas: Tile[] }[] = [];
  for (let i = 0; i < game.chain.length; i += perRow) {
    filas.push({ desde: i, fichas: game.chain.slice(i, i + perRow) });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-center font-bold transition-colors",
          view.yourTurn ? "bg-emerald-400 text-sea-950" : "bg-sea-800 text-foam/70",
        ].join(" ")}
      >
        {view.yourTurn ? (
          mustDraw ? (
            "No puedes colocar — roba"
          ) : mustPass ? (
            "No puedes colocar — pasa"
          ) : (
            "Tu turno"
          )
        ) : (
          <>
            Turno del rival
            <Thinking active={thinking} />
          </>
        )}
      </div>

      {/* Mientras eliges ficha estás mirando tu mano, no la cadena: si el
          rival coloca y no se dice, la jugada pasa desapercibida. */}
      {game.lastPlay && game.lastPlay.side !== view.you && (
        <p
          key={`jugada-${game.chain.length}`}
          className="animate-alert flex items-center justify-center gap-2 rounded-lg bg-water/[0.18] px-3 py-2 text-center text-sm text-foam ring-1 ring-water/70"
        >
          El rival ha colocado la
          <TileView tile={game.lastPlay.tile} className="!h-6 !w-12" />
          por la {game.lastPlay.end === "left" ? "izquierda" : "derecha"}
        </p>
      )}

      {game.lastDrawn && game.lastDrawn.count > 0 && (
        <p
          key={`robo-${game.lastDrawn.side}-${game.poolCount}`}
          className="animate-alert rounded-lg bg-sea-800/80 px-3 py-2 text-center text-sm text-foam/75"
        >
          {game.lastDrawn.side === view.you ? "Has robado" : "El rival ha robado"}{" "}
          {game.lastDrawn.count} {game.lastDrawn.count === 1 ? "ficha" : "fichas"}
        </p>
      )}

      <div className="flex items-center justify-between px-1 text-xs text-foam/55">
        <span>Rival: {game.rivalTiles} fichas</span>
        <span>Pozo: {game.poolCount}</span>
        <span>Tus puntos: {game.yourPips}</span>
      </div>

      {/* Las puntas, siempre a la vista: es lo único que necesitas para saber
          qué te vale, y antes había que ir a buscarlas a la cadena. */}
      {game.ends && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-foam/55">Puntas</span>
          <span className="min-w-8 rounded-md bg-sea-700 px-2.5 py-1 text-center font-bold tabular-nums ring-1 ring-sea-500/60">
            {game.ends[0]}
          </span>
          <span className="text-foam/35">y</span>
          <span className="min-w-8 rounded-md bg-sea-700 px-2.5 py-1 text-center font-bold tabular-nums ring-1 ring-sea-500/60">
            {game.ends[1]}
          </span>
        </div>
      )}

      <div
        ref={chainRef}
        className="min-h-[3.25rem] rounded-xl bg-sea-900/60 p-2 ring-1 ring-sea-700/60"
      >
        {game.chain.length === 0 ? (
          <p className="py-3 text-center text-sm text-foam/40">
            Sale la ficha más alta. Coloca la primera.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {filas.map((fila, r) => (
              <div
                key={fila.desde}
                className={["flex gap-1", r % 2 === 1 ? "flex-row-reverse" : ""].join(" ")}
              >
                {fila.fichas.map((tile, k) => {
                  const i = fila.desde + k;
                  // En una fila que va de derecha a izquierda la ficha también
                  // se ve girada; la etiqueta guarda el orden real de la cadena.
                  const pintada: Tile = r % 2 === 1 ? [tile[1], tile[0]] : tile;
                  return (
                    <TileView
                      key={i}
                      tile={pintada}
                      marked={i === lastIndex}
                      label={`Cadena ${tile[0]} ${tile[1]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Si la ficha elegida encaja por las dos puntas hay que preguntar. */}
      {selected && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!playable}
            onClick={() => send(() => onPlay(selected, "left"))}
            className="rounded-xl bg-sea-700 px-4 py-3 font-semibold ring-1 ring-sea-500/50 active:brightness-110"
          >
            ◀ Por la izquierda
            <span className="block text-xs font-medium opacity-60">
              punta {game.ends?.[0]}
            </span>
          </button>
          <button
            type="button"
            disabled={!playable}
            onClick={() => send(() => onPlay(selected, "right"))}
            className="rounded-xl bg-sea-700 px-4 py-3 font-semibold ring-1 ring-sea-500/50 active:brightness-110"
          >
            Por la derecha ▶
            <span className="block text-xs font-medium opacity-60">
              punta {game.ends?.[1]}
            </span>
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foam/70">Tus fichas</h2>
        <div className="flex flex-wrap justify-center gap-1.5">
          {game.yourHand.map((tile, i) => {
            const opciones = playable ? endsFor(tile) : [];
            const elegida = selected !== null && sameTile(selected, tile);
            return (
              <button
                key={`${tile[0]}-${tile[1]}-${i}`}
                type="button"
                disabled={!playable || opciones.length === 0}
                onClick={() => tap(tile)}
                aria-label={`Ficha ${tile[0]} ${tile[1]}`}
                // Se apaga lo que no encaja, pero sólo en tu turno: mientras
                // juega el rival no hay nada que decidir y apagar la mano
                // entera sólo hace que no puedas ir pensando la jugada.
                className={[
                  "rounded-md transition-opacity",
                  playable && opciones.length === 0 ? "opacity-40" : "",
                ].join(" ")}
              >
                <TileView
                  tile={tile}
                  upright
                  // Un solo anillo: la elegida manda sobre la simplemente jugable.
                  className={
                    elegida
                      ? "ring-2 ring-emerald-300"
                      : opciones.length > 0
                        ? "ring-2 ring-emerald-400/45"
                        : ""
                  }
                />
              </button>
            );
          })}
        </div>
      </section>

      {mustDraw && (
        <button
          type="button"
          onClick={() => send(onDraw)}
          className="rounded-xl bg-emerald-400 px-4 py-4 text-lg font-bold text-sea-950 active:brightness-110"
        >
          Robar del pozo
          <span className="block text-sm font-medium opacity-70">
            Quedan {game.poolCount} — robas hasta poder colocar
          </span>
        </button>
      )}

      {mustPass && (
        <button
          type="button"
          onClick={() => send(onPass)}
          className="rounded-xl bg-sea-700 px-4 py-4 text-lg font-bold ring-1 ring-sea-500/50 active:brightness-110"
        >
          Pasar turno
          <span className="block text-sm font-medium opacity-70">
            Pozo vacío y no encaja nada
          </span>
        </button>
      )}

      {playable && hasPlay && !selected && (
        <p className="text-center text-xs text-foam/40">
          Toca una ficha resaltada. Si encaja por las dos puntas, te pregunto por cuál.
        </p>
      )}
    </div>
  );
}
