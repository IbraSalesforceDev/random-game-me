import {
  type Board,
  flood,
  type Hero,
  type Item,
  lit,
  type Monster,
  type MonsterKind,
  neighbors,
  REACH,
  type Reach,
} from "@/lib/games/dungeon/rules";
import { other, type Side } from "@/lib/games/types";

/** Lo que pasó en el último turno, para poder contarlo. */
export type LastTurn = {
  side: Side;
  /** Casilla en la que acabó, para señalarla. */
  at: number;
  gold: number;
  healed: number;
  sword: boolean;
  shield: boolean;
  /** Se topó con el rival a oscuras y tuvo que pararse. */
  bumped: boolean;
  hit: { what: MonsterKind | "hero"; dmg: number; killed: boolean; at: number } | null;
  /** Daño que le devolvieron los monstruos pegados al acabar. */
  hurt: number;
};

export type DungeonState = Board & {
  heroes: Record<Side, Hero>;
  /** Casillas que cada jugador ha llegado a alumbrar. */
  seen: Record<Side, number[]>;
  turnsLeft: Record<Side, number>;
  last: LastTurn | null;
};

export type DungeonMove = { type: "act"; to: number } | { type: "wait" };

export type ViewCell = {
  /** `unknown` es lo que aún no has alumbrado. */
  k: "unknown" | "wall" | "floor";
  /** Dentro de la luz de tu antorcha ahora mismo. */
  lit: boolean;
  item: Item | null;
  monster: Monster | null;
  hero: Side | null;
};

export type DungeonView = {
  cells: ViewCell[];
  you: Hero;
  /** Del rival se sabe la vida y el botín; dónde está, sólo si lo alumbras. */
  rival: Omit<Hero, "pos"> & { pos: number | null };
  /** Casillas a las que llegas andando este turno. */
  reach: Reach;
  /** Enemigos a tiro: casilla del enemigo → casilla desde la que le pegas. */
  targets: Record<number, number>;
  turnsLeft: number;
  last: LastTurn | null;
};

export const visibleTo = (state: DungeonState, side: Side) =>
  new Set(lit(state.heroes[side].pos));

/**
 * A dónde puede ir y a quién puede pegar un jugador. Sólo cuenta con lo que él
 * conoce: camina por casillas que ha visto, y el rival sólo le estorba si lo
 * tiene alumbrado. Si se lo encuentra a oscuras, se topa con él al andar.
 */
export function optionsFor(state: DungeonState, side: Side) {
  const me = state.heroes[side];
  const rival = state.heroes[other(side)];
  const luz = visibleTo(state, side);
  const rivalALaVista = luz.has(rival.pos);

  const libre = (i: number) =>
    Boolean(state.seen[side][i]) &&
    !state.walls[i] &&
    !state.monsters[i] &&
    !(rivalALaVista && i === rival.pos);

  const reach = flood(me.pos, libre, REACH);

  const targets: Record<number, number> = {};
  const enemigos: number[] = [];
  state.monsters.forEach((m, i) => {
    if (m && state.seen[side][i]) enemigos.push(i);
  });
  if (rivalALaVista) enemigos.push(rival.pos);

  for (const e of enemigos) {
    let mejor = -1;
    for (const n of neighbors(e)) {
      // Pegar gasta un paso, así que hay que llegar con uno de sobra.
      if (!(n in reach) || reach[n].d > REACH - 1) continue;
      if (mejor === -1 || reach[n].d < reach[mejor].d) mejor = n;
    }
    if (mejor !== -1) targets[e] = mejor;
  }

  return { reach, targets };
}

/**
 * La vista de un jugador. Vive aparte del módulo para que el bot juegue con
 * exactamente lo mismo que ve una persona: su mapa explorado y nada más.
 */
export function viewFor(state: DungeonState, side: Side): DungeonView {
  const rival = state.heroes[other(side)];
  const luz = visibleTo(state, side);
  const { reach, targets } = optionsFor(state, side);

  const cells: ViewCell[] = state.walls.map((wall, i) => {
    if (!state.seen[side][i]) {
      return { k: "unknown", lit: false, item: null, monster: null, hero: null };
    }
    const hero =
      i === state.heroes[side].pos ? side : i === rival.pos && luz.has(i) ? other(side) : null;
    return {
      k: wall ? "wall" : "floor",
      lit: luz.has(i),
      item: state.items[i],
      monster: state.monsters[i],
      hero,
    };
  });

  // Lo que hizo el rival sólo se cuenta si te afectó o lo viste.
  const last = state.last;
  const contable =
    last &&
    (last.side === side || last.hit?.what === "hero" || luz.has(last.at)) ? last : null;

  return {
    cells,
    you: state.heroes[side],
    rival: {
      hp: rival.hp,
      atk: rival.atk,
      def: rival.def,
      gold: rival.gold,
      pos: luz.has(rival.pos) ? rival.pos : null,
    },
    reach,
    targets,
    turnsLeft: state.turnsLeft[side],
    last: contable,
  };
}
