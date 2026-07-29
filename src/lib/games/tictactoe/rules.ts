import type { Side } from "@/lib/games/types";

export const SIZE = 3;
export const CELLS = SIZE * SIZE;

/** Las nueve casillas leídas de izquierda a derecha y de arriba abajo. */
export type Cells = (Side | null)[];

export function emptyCells(): Cells {
  return Array.from({ length: CELLS }, () => null);
}

/** Las ocho líneas que ganan: tres filas, tres columnas y dos diagonales. */
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Línea completada por un mismo jugador, o `null` si no hay ninguna. */
export function winningLine(cells: Cells): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return [...line];
  }
  return null;
}

export function isFull(cells: Cells): boolean {
  return cells.every((cell) => cell !== null);
}

export const cellLabel = (index: number) =>
  `fila ${Math.floor(index / SIZE) + 1}, columna ${(index % SIZE) + 1}`;
