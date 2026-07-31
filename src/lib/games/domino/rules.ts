import type { Side } from "@/lib/games/types";

/**
 * Una ficha. Al repartirse va con el número menor delante; dentro de la cadena
 * se guarda ya orientada, de modo que `tile[1]` de una casa siempre con
 * `tile[0]` de la siguiente.
 */
export type Tile = [number, number];

/** Punta de la cadena por la que se coloca. */
export type End = "left" | "right";

export const MAX_PIP = 6;
export const HAND_SIZE = 7;

export const pips = (t: Tile) => t[0] + t[1];
export const isDouble = (t: Tile) => t[0] === t[1];

/** Dos fichas son la misma aunque estén giradas. */
export const sameTile = (a: Tile, b: Tile) =>
  (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

export const tileKey = (t: Tile) => `${Math.min(t[0], t[1])}-${Math.max(t[0], t[1])}`;

/** El doble seis completo: 28 fichas. */
export function fullSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= MAX_PIP; a++) {
    for (let b = a; b <= MAX_PIP; b++) tiles.push([a, b]);
  }
  return tiles;
}

function shuffled<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Reparte siete a cada uno y deja las catorce restantes en el pozo. */
export function deal(): { hands: Record<Side, Tile[]>; pool: Tile[] } {
  const tiles = shuffled(fullSet());
  return {
    hands: {
      host: tiles.slice(0, HAND_SIZE),
      guest: tiles.slice(HAND_SIZE, HAND_SIZE * 2),
    },
    pool: tiles.slice(HAND_SIZE * 2),
  };
}

/**
 * Peso para decidir quién abre: manda el doble más alto y, si no hay dobles en
 * ninguna mano, la ficha más gorda. El desempate por la cara mayor evita que
 * dos fichas de los mismos puntos queden igualadas.
 */
const rank = (t: Tile) => (isDouble(t) ? 1000 : 0) + pips(t) * 10 + Math.max(t[0], t[1]);

const best = (hand: Tile[]) => hand.reduce((m, t) => Math.max(m, rank(t)), -1);

/** Quién sale, según la mano repartida. */
export function opener(hands: Record<Side, Tile[]>): Side {
  return best(hands.host) >= best(hands.guest) ? "host" : "guest";
}

/** Valores de las dos puntas. `null` con la cadena vacía. */
export function ends(chain: Tile[]): [number, number] | null {
  if (chain.length === 0) return null;
  return [chain[0][0], chain[chain.length - 1][1]];
}

/** Puntas por las que encaja una ficha. La primera del juego encaja siempre. */
export function fits(chain: Tile[], tile: Tile): End[] {
  const e = ends(chain);
  if (!e) return ["right"];
  const out: End[] = [];
  if (tile[0] === e[0] || tile[1] === e[0]) out.push("left");
  if (tile[0] === e[1] || tile[1] === e[1]) out.push("right");
  return out;
}

/** Coloca la ficha girándola sola para que case con la punta elegida. */
export function place(chain: Tile[], tile: Tile, end: End): Tile[] {
  const e = ends(chain);
  if (!e) return [tile];

  if (end === "left") {
    // Por la izquierda tiene que acabar en el valor de esa punta.
    const oriented: Tile = tile[1] === e[0] ? [tile[0], tile[1]] : [tile[1], tile[0]];
    return [oriented, ...chain];
  }
  const oriented: Tile = tile[0] === e[1] ? [tile[0], tile[1]] : [tile[1], tile[0]];
  return [...chain, oriented];
}

export type Play = { tile: Tile; end: End };

/** Todas las jugadas legales de una mano. */
export function legalPlays(chain: Tile[], hand: Tile[]): Play[] {
  const out: Play[] = [];
  for (const tile of hand) {
    for (const end of fits(chain, tile)) out.push({ tile, end });
  }
  return out;
}

export const canPlay = (chain: Tile[], hand: Tile[]) =>
  hand.some((t) => fits(chain, t).length > 0);

export const handPips = (hand: Tile[]) => hand.reduce((n, t) => n + pips(t), 0);
