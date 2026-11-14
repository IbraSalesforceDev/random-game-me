import {
  type Board,
  DOOR,
  edgeOf,
  flood,
  type Hero,
  type Item,
  lit,
  type Monster,
  type MonsterKind,
  neighbors,
  passable,
  type Reach,
  stepsOf,
  TEAM_GOAL,
  W,
  WALL,
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
  haste: boolean;
  ward: boolean;
  /** Abrió alguna puerta por el camino. */
  opened: boolean;
  /** Se topó con el rival a oscuras y tuvo que pararse. */
  bumped: boolean;
  /** Abrió una puerta y había un monstruo justo detrás. */
  ambush: MonsterKind | null;
  hit: { what: MonsterKind | "hero"; dmg: number; killed: boolean; at: number } | null;
  /** Daño que le devolvieron los monstruos pegados al acabar. */
  hurt: number;
  /** En cooperativo: cada golpe de monstruo de esta ronda, y a quién. */
  bites?: { kind: MonsterKind; dmg: number; who: Side }[];
};

export type DungeonState = Board & {
  heroes: Record<Side, Hero>;
  /** Casillas que cada jugador ha llegado a alumbrar. */
  seen: Record<Side, number[]>;
  turnsLeft: Record<Side, number>;
  last: LastTurn | null;
  /** Los dos van juntos contra la mazmorra. Sin esto, es un duelo. */
  coop?: boolean;
  /** Cómo acabó la partida cooperativa. */
  result?: "won" | "lost";
};

export type DungeonMove = { type: "act"; to: number } | { type: "wait" };

export type ViewCell = {
  /** Lo que aún no has alumbrado no se enseña. */
  known: boolean;
  /** Dentro de la luz de tu antorcha ahora mismo. */
  lit: boolean;
  item: Item | null;
  monster: Monster | null;
  hero: Side | null;
};

export type DungeonView = {
  cells: ViewCell[];
  /** Bordes conocidos, con −1 donde aún no has visto ninguna de las dos casillas. */
  east: number[];
  south: number[];
  you: Hero;
  /** Del rival se sabe la vida y el botín; dónde está, sólo si lo alumbras. */
  rival: Omit<Hero, "pos"> & { pos: number | null };
  /** Casillas a las que llegas andando este turno. */
  reach: Reach;
  /** Enemigos a tiro: casilla del enemigo → casilla desde la que le pegas. */
  targets: Record<number, number>;
  turnsLeft: number;
  last: LastTurn | null;
  /** Partida en equipo: `rival` es tu compañero y `goal` el oro que hay que reunir. */
  coop: boolean;
  goal: number;
};

/** Lo que se alumbra: en duelo, tu antorcha; en equipo, la de los dos. */
export const visibleTo = (state: DungeonState, side: Side) =>
  new Set(
    state.coop
      ? [...lit(state, state.heroes.host.pos), ...lit(state, state.heroes.guest.pos)]
      : lit(state, state.heroes[side].pos),
  );

/**
 * A dónde puede ir y a quién puede pegar un jugador. Sólo cuenta con lo que él
 * conoce: camina por casillas que ha visto, y el rival sólo le estorba si lo
 * tiene alumbrado. La única forma de pisar algo sin ver es cruzar una puerta
 * cerrada: se abre al pasar y ya se verá qué hay detrás.
 */
export function optionsFor(state: DungeonState, side: Side) {
  const me = state.heroes[side];
  const rival = state.heroes[other(side)];
  const seen = state.seen[side];
  const luz = visibleTo(state, side);
  const rivalALaVista = luz.has(rival.pos);
  const pasos = stepsOf(me);

  // En equipo los monstruos se mueven, así que sólo se sabe de los alumbrados.
  const monstruoVisto = (i: number) => Boolean(state.monsters[i]) && (!state.coop || luz.has(i));
  const libre = (i: number) => !monstruoVisto(i) && !(rivalALaVista && i === rival.pos);

  const reach = flood(
    me.pos,
    (cur, next) => {
      // Desde lo desconocido no se planea más allá.
      if (!seen[cur]) return false;
      const borde = edgeOf(state, cur, next);
      if (borde === WALL) return false;
      if (seen[next]) return libre(next);
      return borde === DOOR;
    },
    pasos,
  );

  const targets: Record<number, number> = {};
  const enemigos: number[] = [];
  state.monsters.forEach((m, i) => {
    if (m && seen[i] && monstruoVisto(i)) enemigos.push(i);
  });
  // Al compañero no se le pega.
  if (rivalALaVista && !state.coop) enemigos.push(rival.pos);

  for (const e of enemigos) {
    let mejor = -1;
    for (const n of neighbors(e)) {
      // Pegar gasta un paso, así que hay que llegar con uno de sobra, y no
      // se pega a través de un muro ni de una puerta cerrada.
      if (!(n in reach) || !seen[n] || reach[n].d > pasos - 1) continue;
      if (!passable(edgeOf(state, n, e))) continue;
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
  const seen = state.seen[side];
  const luz = visibleTo(state, side);
  const { reach, targets } = optionsFor(state, side);

  const cells: ViewCell[] = seen.map((visto, i) => {
    if (!visto) return { known: false, lit: false, item: null, monster: null, hero: null };
    const hero =
      i === state.heroes[side].pos ? side : i === rival.pos && luz.has(i) ? other(side) : null;
    return {
      known: true,
      lit: luz.has(i),
      item: state.items[i],
      monster: state.coop && !luz.has(i) ? null : state.monsters[i],
      hero,
    };
  });

  // Un borde se conoce en cuanto se ha visto una de las dos casillas que separa.
  const east = state.east.map((v, i) => (seen[i] || seen[i + 1] ? v : -1));
  const south = state.south.map((v, i) => (seen[i] || seen[i + W] ? v : -1));

  // Lo que hizo el rival sólo se cuenta si te afectó o lo viste.
  const last = state.last;
  const contable =
    last && (state.coop || last.side === side || last.hit?.what === "hero" || luz.has(last.at))
      ? last
      : null;

  return {
    cells,
    east,
    south,
    you: state.heroes[side],
    rival: {
      hp: rival.hp,
      atk: rival.atk,
      def: rival.def,
      gold: rival.gold,
      haste: rival.haste,
      ward: rival.ward,
      pos: luz.has(rival.pos) ? rival.pos : null,
    },
    reach,
    targets,
    turnsLeft: state.turnsLeft[side],
    last: contable,
    coop: Boolean(state.coop),
    goal: TEAM_GOAL,
  };
}
