import type {
  BattleshipMove,
  BattleshipState,
  BattleshipView,
} from "@/lib/games/battleship/module";
import { battleship } from "@/lib/games/battleship/module";
import {
  BOARD_SIZE,
  cellKey,
  FLEET,
  randomFleet,
  type Shot,
  shipCells,
  shipFootprint,
  type ShipKind,
} from "@/lib/games/battleship/rules";
import type { BotLevel, Side } from "@/lib/games/types";

/**
 * Aquí no vale el minimax: no hay árbol que explorar, sino un tablero oculto
 * sobre el que hay que deducir. La estrategia es la clásica de dos modos —
 * buscar mientras no hay nada tocado, perseguir en cuanto lo hay.
 *
 * El bot trabaja sobre `toView`, es decir, exactamente lo que se le manda a un
 * jugador de carne y hueso. Así no puede hacer trampa ni por descuido: la
 * flota rival sencillamente no está en los datos que maneja.
 */
const inBounds = ({ x, y }: Shot) => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;

const ORTHOGONAL = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Casillas donde ya se disparó, acertando o no. */
function shotCells(view: BattleshipView): Set<string> {
  return new Set(view.yourShots.map((s) => cellKey(s.x, s.y)));
}

/** Impactos que aún no pertenecen a un barco hundido: ahí queda algo vivo. */
function liveHits(view: BattleshipView): Shot[] {
  const sunk = new Set(
    view.opponentSunk.flatMap(shipCells).map((c) => cellKey(c.x, c.y)),
  );
  return view.yourShots
    .filter((s) => s.hit && !sunk.has(cellKey(s.x, s.y)))
    .map(({ x, y }) => ({ x, y }));
}

function remainingKinds(view: BattleshipView): ShipKind[] {
  const sunk = new Set(view.opponentSunk.map((s) => s.id));
  return FLEET.filter((kind) => !sunk.has(kind.id));
}

/**
 * Casillas donde ya se sabe que no puede haber barco: agua confirmada, barcos
 * hundidos, y el anillo alrededor de éstos —porque los barcos no se tocan—.
 */
function ruledOut(view: BattleshipView): Set<string> {
  const out = new Set<string>();
  for (const shot of view.yourShots) {
    if (!shot.hit) out.add(cellKey(shot.x, shot.y));
  }
  for (const ship of view.opponentSunk) {
    for (const key of shipFootprint(ship)) out.add(key);
  }
  return out;
}

/** Persigue un barco tocado: alarga la línea si la hay, o prueba alrededor. */
function chase(view: BattleshipView, hits: Shot[]): Shot | null {
  const shot = shotCells(view);
  const hitKeys = new Set(hits.map((h) => cellKey(h.x, h.y)));
  const free = (c: Shot) => inBounds(c) && !shot.has(cellKey(c.x, c.y));

  // Con dos impactos en línea, el barco va en esa dirección: se prueban los
  // dos extremos antes que cualquier casilla suelta.
  const ends: Shot[] = [];
  for (const hit of hits) {
    for (const dir of ORTHOGONAL) {
      const neighbour = { x: hit.x + dir.x, y: hit.y + dir.y };
      if (!hitKeys.has(cellKey(neighbour.x, neighbour.y))) continue;

      // Extremo por delante del vecino y por detrás del impacto.
      const ahead = { x: neighbour.x + dir.x, y: neighbour.y + dir.y };
      const behind = { x: hit.x - dir.x, y: hit.y - dir.y };
      if (free(ahead)) ends.push(ahead);
      if (free(behind)) ends.push(behind);
    }
  }
  if (ends.length > 0) return pick(ends);

  // Un solo impacto: se tantean sus cuatro costados.
  const around = hits
    .flatMap((hit) => ORTHOGONAL.map((d) => ({ x: hit.x + d.x, y: hit.y + d.y })))
    .filter(free);

  return around.length > 0 ? pick(around) : null;
}

/**
 * Mapa de probabilidad: cuenta, para cada casilla, en cuántas colocaciones
 * posibles de los barcos que quedan aparecería. Dispara donde más cabe.
 */
function densest(view: BattleshipView): Shot | null {
  const impossible = ruledOut(view);
  const shot = shotCells(view);
  const counts = new Map<string, number>();

  for (const kind of remainingKinds(view)) {
    for (const horizontal of [true, false]) {
      const maxX = horizontal ? BOARD_SIZE - kind.size : BOARD_SIZE - 1;
      const maxY = horizontal ? BOARD_SIZE - 1 : BOARD_SIZE - kind.size;

      for (let x = 0; x <= maxX; x++) {
        for (let y = 0; y <= maxY; y++) {
          const cells = Array.from({ length: kind.size }, (_, i) => ({
            x: horizontal ? x + i : x,
            y: horizontal ? y : y + i,
          }));
          if (cells.some((c) => impossible.has(cellKey(c.x, c.y)))) continue;

          for (const c of cells) {
            const key = cellKey(c.x, c.y);
            if (shot.has(key)) continue; // ya disparada, no sirve de objetivo
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
      }
    }
  }

  if (counts.size === 0) return null;
  const best = Math.max(...counts.values());
  const candidates = [...counts.entries()]
    .filter(([, n]) => n === best)
    .map(([key]) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    });

  return pick(candidates);
}

function randomTarget(view: BattleshipView): Shot | null {
  const shot = shotCells(view);
  const free: Shot[] = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (!shot.has(cellKey(x, y))) free.push({ x, y });
    }
  }
  return free.length > 0 ? pick(free) : null;
}

function chooseShot(view: BattleshipView, level: BotLevel): Shot | null {
  // El fácil dispara a voleo: ni persigue lo que ya ha tocado.
  if (level === "easy") return randomTarget(view);

  const hits = liveHits(view);
  if (hits.length > 0) {
    const target = chase(view, hits);
    if (target) return target;
  }

  // El normal busca a ciegas; el difícil, por donde más barcos caben.
  return level === "hard" ? (densest(view) ?? randomTarget(view)) : randomTarget(view);
}

export function battleshipBot(
  state: BattleshipState,
  side: Side,
  level: BotLevel,
): BattleshipMove | null {
  const view = battleship.toView(state, side) as BattleshipView;

  // Fase de colocación: pone su flota y ya está.
  if (view.phase === "placing") {
    return view.yourFleetReady ? null : { type: "ships", ships: randomFleet() };
  }

  const target = chooseShot(view, level);
  return target ? { type: "fire", x: target.x, y: target.y } : null;
}
