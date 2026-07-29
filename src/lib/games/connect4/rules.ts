import type { Side } from "@/lib/games/types";

export const COLUMNS = 7;
export const ROWS = 6;
const IN_A_ROW = 4;

/** Una columna vista de abajo arriba: `column[0]` es la casilla del fondo. */
export type Column = (Side | null)[];
export type Grid = Column[];

export function emptyGrid(): Grid {
  return Array.from({ length: COLUMNS }, () => Array.from({ length: ROWS }, () => null));
}

export function isColumnFull(grid: Grid, col: number): boolean {
  return grid[col].every((cell) => cell !== null);
}

export function isGridFull(grid: Grid): boolean {
  return grid.every((_, col) => isColumnFull(grid, col));
}

/** Fila en la que caería una ficha soltada en `col`, o -1 si está llena. */
export function dropRow(grid: Grid, col: number): number {
  return grid[col].findIndex((cell) => cell === null);
}

const DIRECTIONS = [
  [1, 0], // →
  [0, 1], // ↑
  [1, 1], // ↗
  [1, -1], // ↘
] as const;

/**
 * Devuelve las casillas de la línea ganadora que pasa por (col, row), o `null`
 * si esa ficha no completa cuatro en raya.
 */
export function winningLine(
  grid: Grid,
  col: number,
  row: number,
): { col: number; row: number }[] | null {
  const side = grid[col]?.[row];
  if (!side) return null;

  for (const [dc, dr] of DIRECTIONS) {
    const line = [{ col, row }];

    // Se extiende en los dos sentidos desde la ficha recién puesta.
    for (const sign of [1, -1]) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (grid[c]?.[r] === side) {
        line.push({ col: c, row: r });
        c += dc * sign;
        r += dr * sign;
      }
    }

    if (line.length >= IN_A_ROW) return line;
  }

  return null;
}
