import {
  applyMoveToBoard,
  type Board,
  capturesFrom,
  CELLS,
  countPieces,
  initialBoard,
  legalMoves,
  type Move,
} from "@/lib/games/checkers/rules";
import { defineGame, type MoveResult, other, type Side } from "@/lib/games/types";

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

    const { board, crowned } = applyMoveToBoard(state.board, chosen);

    // Si acaba de comer y puede seguir, la cadena continúa con la misma pieza.
    // Coronar corta la cadena aunque quedaran capturas.
    const sigue =
      chosen.captured.length > 0 && !crowned && capturesFrom(board, chosen.to).length > 0;

    if (sigue) {
      return {
        ok: true,
        state: { board, chainFrom: chosen.to, lastMove: chosen },
        turn: side,
        winner: null,
        finished: false,
      };
    }

    // Pierde quien se queda sin piezas o sin ningún movimiento legal.
    const rival = other(side);
    const rivalPerdido =
      countPieces(board, rival) === 0 || legalMoves(board, rival, null).length === 0;

    return {
      ok: true,
      state: { board, chainFrom: null, lastMove: chosen },
      turn: rivalPerdido ? null : rival,
      winner: rivalPerdido ? side : null,
      finished: rivalPerdido,
    };
  },
});

const isCell = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < CELLS;

export type { Side };
