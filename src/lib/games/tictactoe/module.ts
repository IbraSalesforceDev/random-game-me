import {
  CELLS,
  type Cells,
  emptyCells,
  isFull,
  winningLine,
} from "@/lib/games/tictactoe/rules";
import { tictactoeBot } from "@/lib/games/tictactoe/bot";
import { defineGame, type MoveResult, other } from "@/lib/games/types";

export type TicTacToeState = {
  cells: Cells;
  lastMove: number | null;
  winningLine: number[] | null;
};

export type TicTacToeMove = { type: "mark"; cell: number };

/** Tablero a la vista: los dos jugadores ven exactamente lo mismo. */
export type TicTacToeView = TicTacToeState;

export const tictactoe = defineGame<TicTacToeState, TicTacToeMove>({
  id: "tictactoe",
  name: "Tres en raya",
  emoji: "❌",
  tagline: "Tres seguidas y ganas. Rápido y con mala idea.",

  createState: () => ({ cells: emptyCells(), lastMove: null, winningLine: null }),

  initialTurn: () => "host",

  toView: (state) => state,

  bot: tictactoeBot,

  applyMove(state, side, move): MoveResult<TicTacToeState> {
    if (move?.type !== "mark") return { ok: false, error: "Movimiento desconocido" };

    const { cell } = move;
    if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) {
      return { ok: false, error: "Casilla no válida" };
    }
    if (state.cells[cell]) return { ok: false, error: "Esa casilla ya está ocupada" };

    const cells = state.cells.map((c, i) => (i === cell ? side : c));
    const line = winningLine(cells);
    const draw = !line && isFull(cells);

    return {
      ok: true,
      state: { cells, lastMove: cell, winningLine: line },
      turn: line || draw ? null : other(side),
      winner: line ? side : null,
      finished: Boolean(line) || draw,
    };
  },
});
