import { checkersBot } from "@/lib/games/checkers/bot";
import {
  advance,
  type Board,
  CELLS,
  initialBoard,
  legalMoves,
  type Move,
} from "@/lib/games/checkers/rules";
import { defineGame, type MoveResult, type Side } from "@/lib/games/types";

export type CheckersState = {
  board: Board;
  /** Casilla que debe seguir comiendo, si hay una cadena en curso. */
  chainFrom: number | null;
  lastMove: Move | null;
};

export type CheckersMove = { type: "move"; from: number; to: number };

/** Aquí no hay nada oculto: los dos ven el mismo tablero. */
export type CheckersView = CheckersState;

export const checkers = defineGame<CheckersState, CheckersMove>({
  id: "checkers",
  name: "Damas",
  emoji: "⚫",
  tagline: "Comer es obligatorio. Corona y arrasa la diagonal.",

  createState: () => ({ board: initialBoard(), chainFrom: null, lastMove: null }),

  initialTurn: () => "host",

  toView: (state) => state,

  bot: checkersBot,

  applyMove(state, side, move): MoveResult<CheckersState> {
    if (move?.type !== "move") return { ok: false, error: "Movimiento desconocido" };

    const { from, to } = move;
    if (!isCell(from) || !isCell(to)) return { ok: false, error: "Casilla no válida" };
    if (state.board[from]?.side !== side) return { ok: false, error: "Esa pieza no es tuya" };

    const legal = legalMoves(state.board, side, state.chainFrom);
    const chosen = legal.find((m) => m.from === from && m.to === to);
    if (!chosen) {
      const hayCapturas = legal.some((m) => m.captured.length > 0);
      return {
        ok: false,
        error: hayCapturas ? "Comer es obligatorio" : "Ese movimiento no vale",
      };
    }

    const next = advance(state.board, side, chosen);

    return {
      ok: true,
      state: { board: next.board, chainFrom: next.chainFrom, lastMove: chosen },
      turn: next.turn,
      winner: next.winner,
      finished: next.finished,
    };
  },
});

const isCell = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < CELLS;

export type { Side };
