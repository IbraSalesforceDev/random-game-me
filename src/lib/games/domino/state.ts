import {
  type End,
  ends,
  handPips,
  legalPlays,
  type Play,
  type Tile,
} from "@/lib/games/domino/rules";
import { other, type Side } from "@/lib/games/types";

export type DominoState = {
  hands: Record<Side, Tile[]>;
  pool: Tile[];
  /** Fichas ya colocadas, de punta izquierda a punta derecha. */
  chain: Tile[];
  /**
   * Cada vez que alguien pasa se apunta con qué puntas lo hizo: es información
   * pública —ha ocurrido en la mesa— y con ella se deduce qué le falta.
   */
  passes: { side: Side; ends: [number, number] }[];
  /** Pases seguidos. Con dos, la partida está cerrada. */
  passStreak: number;
  lastPlay: { side: Side; tile: Tile; end: End } | null;
  /** Cuántas robó el último en robar, para poder avisarlo. */
  lastDrawn: { side: Side; count: number } | null;
};

export type DominoMove =
  | { type: "play"; tile: Tile; end: End }
  | { type: "draw" }
  | { type: "pass" };

/** Lo que ve un jugador: su mano sí, la del rival sólo contada. */
export type DominoView = {
  yourHand: Tile[];
  yourPips: number;
  rivalTiles: number;
  chain: Tile[];
  ends: [number, number] | null;
  poolCount: number;
  /** Tus jugadas legales ahora mismo. */
  plays: Play[];
  lastPlay: { side: Side; tile: Tile; end: End } | null;
  lastDrawn: { side: Side; count: number } | null;
  /** Valores que el rival ha demostrado no tener, por haber pasado con ellos. */
  rivalLacks: number[];
};

/** Valores que un lado ha enseñado no tener al pasar. */
export function lacksOf(state: DominoState, side: Side): number[] {
  const out = new Set<number>();
  for (const p of state.passes) {
    if (p.side !== side) continue;
    out.add(p.ends[0]);
    out.add(p.ends[1]);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Vive aquí, y no dentro del módulo, para que el bot pueda usar exactamente la
 * misma vista que recibe una persona. Si mirase el estado entero podría contar
 * las fichas del rival, que es justo lo que no debe poder hacer.
 */
export function viewFor(state: DominoState, side: Side): DominoView {
  const hand = state.hands[side];
  return {
    yourHand: hand,
    yourPips: handPips(hand),
    rivalTiles: state.hands[other(side)].length,
    chain: state.chain,
    ends: ends(state.chain),
    poolCount: state.pool.length,
    plays: legalPlays(state.chain, hand),
    lastPlay: state.lastPlay,
    lastDrawn: state.lastDrawn,
    rivalLacks: lacksOf(state, other(side)),
  };
}
