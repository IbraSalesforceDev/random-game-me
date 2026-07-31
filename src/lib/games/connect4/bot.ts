import { bestMove, type Difficulty, type Searchable } from "@/lib/games/bot/minimax";
import type { Connect4Move, Connect4State } from "@/lib/games/connect4/module";
import {
  COLUMNS,
  dropRow,
  type Grid,
  isGridFull,
  ROWS,
  winningLine,
} from "@/lib/games/connect4/rules";
import { type BotLevel, other, type Side } from "@/lib/games/types";

const LEVELS: Record<BotLevel, Difficulty> = {
  easy: { depth: 1, blunder: 0.45 },
  medium: { depth: 4, blunder: 0.12 },
  hard: { depth: 6, blunder: 0 },
};

/**
 * Las 69 ventanas de cuatro casillas en raya del tablero. Se calculan una vez
 * porque la evaluación las recorre en cada nodo de la búsqueda.
 */
const WINDOWS: { col: number; row: number }[][] = (() => {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const;
  const out: { col: number; row: number }[][] = [];
  for (let col = 0; col < COLUMNS; col++) {
    for (let row = 0; row < ROWS; row++) {
      for (const [dc, dr] of dirs) {
        const cells = Array.from({ length: 4 }, (_, k) => ({
          col: col + dc * k,
          row: row + dr * k,
        }));
        if (cells.every((c) => c.col < COLUMNS && c.row >= 0 && c.row < ROWS)) out.push(cells);
      }
    }
  }
  return out;
})();

/** Puntúa una ventana: tres seguidas valen mucho, y las del rival más aún. */
function windowScore(mias: number, suyas: number): number {
  if (mias > 0 && suyas > 0) return 0; // ventana muerta para los dos
  if (mias === 3) return 50;
  if (mias === 2) return 8;
  if (mias === 1) return 1;
  // Tapar al rival pesa algo más que construir: si no, se deja ganar.
  if (suyas === 3) return -80;
  if (suyas === 2) return -10;
  if (suyas === 1) return -1;
  return 0;
}

const searchable: Searchable<Connect4State, Connect4Move> = {
  moves: (state) =>
    [...Array(COLUMNS).keys()]
      // Del centro hacia fuera: son mejores jugadas y la poda corta antes.
      .sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3))
      .filter((col) => dropRow(state.grid, col) !== -1)
      .map((col) => ({ type: "drop", col })),

  play(state, side, move) {
    const row = dropRow(state.grid, move.col);
    const grid: Grid = state.grid.map((column, i) =>
      i === move.col ? column.map((cell, j) => (j === row ? side : cell)) : column,
    );
    const line = winningLine(grid, move.col, row);
    const draw = !line && isGridFull(grid);
    return {
      state: { grid, lastDrop: { col: move.col, row }, winningLine: line },
      turn: line || draw ? null : other(side),
      winner: line ? side : null,
      finished: Boolean(line) || draw,
    };
  },

  evaluate(state, me) {
    const rival = other(me);
    let score = 0;

    for (const window of WINDOWS) {
      let mias = 0;
      let suyas = 0;
      for (const { col, row } of window) {
        const cell = state.grid[col][row];
        if (cell === me) mias++;
        else if (cell === rival) suyas++;
      }
      score += windowScore(mias, suyas);
    }

    // La columna central abre más líneas que ninguna otra.
    for (let row = 0; row < ROWS; row++) {
      const cell = state.grid[3][row];
      if (cell === me) score += 3;
      else if (cell === rival) score -= 3;
    }

    return score;
  },
};

export function connect4Bot(
  state: Connect4State,
  side: Side,
  level: BotLevel,
): Connect4Move | null {
  return bestMove(searchable, state, side, LEVELS[level]);
}
