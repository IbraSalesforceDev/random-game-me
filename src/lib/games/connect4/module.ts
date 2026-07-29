import {
  COLUMNS,
  dropRow,
  emptyGrid,
  type Grid,
  isGridFull,
  winningLine,
} from "@/lib/games/connect4/rules";
import { defineGame, type MoveResult, other } from "@/lib/games/types";

export type Connect4State = {
  grid: Grid;
  lastDrop: { col: number; row: number } | null;
  /** Casillas de la línea que ganó la partida, para poder resaltarla. */
  winningLine: { col: number; row: number }[] | null;
};

export type Connect4Move = { type: "drop"; col: number };

/** Aquí no hay nada que ocultar: los dos ven el mismo tablero. */
export type Connect4View = Connect4State;

export const connect4 = defineGame<Connect4State, Connect4Move>({
  id: "connect4",
  name: "Conecta 4",
  emoji: "🔴",
  tagline: "Alinea cuatro fichas antes que tu rival.",

  createState: () => ({ grid: emptyGrid(), lastDrop: null, winningLine: null }),

  initialTurn: () => "host",

  toView: (state) => state,

  applyMove(state, side, move): MoveResult<Connect4State> {
    if (move?.type !== "drop") return { ok: false, error: "Movimiento desconocido" };

    const { col } = move;
    if (!Number.isInteger(col) || col < 0 || col >= COLUMNS) {
      return { ok: false, error: "Columna no válida" };
    }

    const row = dropRow(state.grid, col);
    if (row === -1) return { ok: false, error: "Esa columna está llena" };

    // Copia en profundidad sólo de la columna que cambia.
    const grid = state.grid.map((column, i) =>
      i === col ? column.map((cell, j) => (j === row ? side : cell)) : column,
    );

    const line = winningLine(grid, col, row);
    const draw = !line && isGridFull(grid);

    return {
      ok: true,
      state: { grid, lastDrop: { col, row }, winningLine: line },
      turn: line || draw ? null : other(side),
      winner: line ? side : null,
      finished: Boolean(line) || draw,
    };
  },
});
