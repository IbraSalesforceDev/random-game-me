import { dominoBot } from "@/lib/games/domino/bot";
import {
  canPlay,
  deal,
  ends,
  fits,
  handPips,
  opener,
  place,
  sameTile,
  type Tile,
} from "@/lib/games/domino/rules";
import {
  type DominoMove,
  type DominoState,
  type DominoView,
  viewFor,
} from "@/lib/games/domino/state";
import { defineGame, type MoveResult, other } from "@/lib/games/types";

export type { DominoMove, DominoState, DominoView };

export const domino = defineGame<DominoState, DominoMove>({
  id: "domino",
  name: "Dominó",
  emoji: "🀫",
  tagline: "Coloca, roba del pozo y déjale sin salida.",

  createState(): DominoState {
    const { hands, pool } = deal();
    return {
      hands,
      pool,
      chain: [],
      passes: [],
      passStreak: 0,
      lastPlay: null,
      lastDrawn: null,
    };
  },

  // Sale quien tenga el doble más alto; si no hay dobles, la ficha más gorda.
  initialTurn: (state) => opener(state.hands),

  toView: viewFor,

  bot: dominoBot,

  applyMove(state, side, move): MoveResult<DominoState> {
    const hand = state.hands[side];
    const puedeJugar = canPlay(state.chain, hand);

    if (move?.type === "play") {
      const { tile, end } = move;
      if (!isTile(tile)) return { ok: false, error: "Ficha no válida" };

      const enMano = hand.find((t) => sameTile(t, tile));
      if (!enMano) return { ok: false, error: "Esa ficha no es tuya" };
      if (end !== "left" && end !== "right") return { ok: false, error: "Punta no válida" };
      if (!fits(state.chain, enMano).includes(end)) {
        return { ok: false, error: "Ahí no encaja" };
      }

      const resto = removeOnce(hand, enMano);
      const next: DominoState = {
        ...state,
        hands: { ...state.hands, [side]: resto },
        chain: place(state.chain, enMano, end),
        // Colocar rompe la racha de pases: ya no va camino de cerrarse.
        passStreak: 0,
        lastPlay: { side, tile: enMano, end },
        lastDrawn: null,
      };

      if (resto.length === 0) {
        return { ok: true, state: next, turn: null, winner: side, finished: true };
      }
      return { ok: true, state: next, turn: other(side), winner: null, finished: false };
    }

    if (move?.type === "draw") {
      if (puedeJugar) return { ok: false, error: "Tienes ficha que colocar" };
      if (state.pool.length === 0) return { ok: false, error: "El pozo está vacío" };

      // Se roba de una tacada hasta poder colocar o agotar el pozo: hacerlo de
      // una en una llenaría la reproducción del bot de pasos sin contenido.
      const pool = [...state.pool];
      const nueva = [...hand];
      let cogidas = 0;
      while (pool.length > 0 && !canPlay(state.chain, nueva)) {
        nueva.push(pool.shift()!);
        cogidas++;
      }

      return {
        ok: true,
        state: {
          ...state,
          hands: { ...state.hands, [side]: nueva },
          pool,
          lastDrawn: { side, count: cogidas },
        },
        // Robar no cede el turno: ahora toca colocar o pasar.
        turn: side,
        winner: null,
        finished: false,
      };
    }

    if (move?.type === "pass") {
      if (puedeJugar) return { ok: false, error: "Tienes ficha que colocar" };
      if (state.pool.length > 0) return { ok: false, error: "Aún queda pozo: roba" };

      const puntas = ends(state.chain);
      const streak = state.passStreak + 1;
      const next: DominoState = {
        ...state,
        passes: puntas ? [...state.passes, { side, ends: puntas }] : state.passes,
        passStreak: streak,
        lastDrawn: null,
      };

      // Dos pases seguidos y la partida se cierra: gana quien tenga menos
      // puntos en la mano, y si empatan es tablas.
      if (streak >= 2) {
        const mios = handPips(next.hands[side]);
        const suyos = handPips(next.hands[other(side)]);
        const winner = mios === suyos ? null : mios < suyos ? side : other(side);
        return { ok: true, state: next, turn: null, winner, finished: true };
      }

      return { ok: true, state: next, turn: other(side), winner: null, finished: false };
    }

    return { ok: false, error: "Movimiento desconocido" };
  },
});

/** Quita una sola copia; las fichas no se repiten, pero por si acaso. */
function removeOnce(hand: Tile[], tile: Tile): Tile[] {
  const i = hand.findIndex((t) => sameTile(t, tile));
  return i < 0 ? hand : [...hand.slice(0, i), ...hand.slice(i + 1)];
}

const isPip = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6;

const isTile = (v: unknown): v is Tile =>
  Array.isArray(v) && v.length === 2 && isPip(v[0]) && isPip(v[1]);
