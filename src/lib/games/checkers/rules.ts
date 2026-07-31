import { other, type Side } from "@/lib/games/types";

export const SIZE = 8;
export const CELLS = SIZE * SIZE;

/**
 * Reglas de damas españolas:
 *  - Sólo se juega en las casillas oscuras.
 *  - Los peones avanzan y capturan hacia delante; la dama recorre la diagonal
 *    entera (dama voladora).
 *  - Capturar es obligatorio, y si tras comer se puede seguir comiendo con la
 *    misma pieza, hay que seguir.
 *  - Coronar termina el turno, aunque quedara cadena por delante.
 */
export type Piece = { side: Side; king: boolean };
export type Board = (Piece | null)[];

export const row = (i: number) => Math.floor(i / SIZE);
export const col = (i: number) => i % SIZE;
export const at = (r: number, c: number) => r * SIZE + c;
export const inBoard = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/** Sólo las casillas oscuras se usan. */
export const isPlayable = (i: number) => (row(i) + col(i)) % 2 === 1;

/** El anfitrión juega abajo y avanza hacia arriba; el invitado al revés. */
export const forwardOf = (side: Side) => (side === "host" ? -1 : 1);

/** Fila de coronación de cada lado. */
export const crownRow = (side: Side) => (side === "host" ? 0 : SIZE - 1);

const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

export function initialBoard(): Board {
  const board: Board = Array.from({ length: CELLS }, () => null);
  for (let i = 0; i < CELLS; i++) {
    if (!isPlayable(i)) continue;
    if (row(i) <= 2) board[i] = { side: "guest", king: false };
    else if (row(i) >= SIZE - 3) board[i] = { side: "host", king: false };
  }
  return board;
}

export type Move = {
  from: number;
  to: number;
  /** Casillas de las piezas comidas en este salto (una, o ninguna). */
  captured: number[];
};

/** Direcciones en las que puede avanzar una pieza. */
function directionsFor(piece: Piece) {
  if (piece.king) return DIAGONALS;
  const fw = forwardOf(piece.side);
  return DIAGONALS.filter(([dr]) => dr === fw);
}

/** Movimientos sin captura desde una casilla. */
export function quietMovesFrom(board: Board, from: number): Move[] {
  const piece = board[from];
  if (!piece) return [];

  const moves: Move[] = [];
  for (const [dr, dc] of directionsFor(piece)) {
    let r = row(from) + dr;
    let c = col(from) + dc;
    while (inBoard(r, c) && !board[at(r, c)]) {
      moves.push({ from, to: at(r, c), captured: [] });
      // El peón sólo avanza una casilla; la dama sigue por la diagonal.
      if (!piece.king) break;
      r += dr;
      c += dc;
    }
  }
  return moves;
}

/** Capturas posibles desde una casilla (un solo salto). */
export function capturesFrom(board: Board, from: number): Move[] {
  const piece = board[from];
  if (!piece) return [];

  const moves: Move[] = [];
  for (const [dr, dc] of directionsFor(piece)) {
    let r = row(from) + dr;
    let c = col(from) + dc;

    // La dama se desliza hasta encontrar la primera pieza; el peón sólo mira
    // la casilla contigua.
    while (inBoard(r, c) && !board[at(r, c)] && piece.king) {
      r += dr;
      c += dc;
    }
    if (!inBoard(r, c)) continue;

    const target = board[at(r, c)];
    if (!target || target.side === piece.side) continue;
    const victim = at(r, c);

    // Se aterriza en cualquier casilla libre pasada la pieza comida.
    let lr = r + dr;
    let lc = c + dc;
    while (inBoard(lr, lc) && !board[at(lr, lc)]) {
      moves.push({ from, to: at(lr, lc), captured: [victim] });
      if (!piece.king) break;
      lr += dr;
      lc += dc;
    }
  }
  return moves;
}

/**
 * Movimientos legales de un lado. Si hay capturas disponibles sólo se
 * devuelven capturas, porque comer es obligatorio. Con `chainFrom` la cadena
 * está en curso y sólo puede seguir esa pieza.
 */
export function legalMoves(board: Board, side: Side, chainFrom: number | null): Move[] {
  if (chainFrom !== null) return capturesFrom(board, chainFrom);

  const own = [...board.keys()].filter((i) => board[i]?.side === side);
  const captures = own.flatMap((i) => capturesFrom(board, i));
  if (captures.length > 0) return captures;
  return own.flatMap((i) => quietMovesFrom(board, i));
}

/** Aplica un movimiento ya validado y devuelve el tablero resultante. */
export function applyMoveToBoard(board: Board, move: Move): { board: Board; crowned: boolean } {
  const next = [...board];
  const piece = next[move.from];
  if (!piece) return { board: next, crowned: false };

  next[move.from] = null;
  for (const victim of move.captured) next[victim] = null;

  const crowned = !piece.king && row(move.to) === crownRow(piece.side);
  next[move.to] = crowned ? { ...piece, king: true } : piece;

  return { board: next, crowned };
}

export function countPieces(board: Board, side: Side): number {
  return board.filter((p) => p?.side === side).length;
}

/** Cómo queda la partida tras un movimiento ya validado. */
export type Advance = {
  board: Board;
  chainFrom: number | null;
  turn: Side | null;
  winner: Side | null;
  finished: boolean;
};

/**
 * Aplica un movimiento legal y resuelve qué pasa después: si la cadena sigue,
 * si toca cambiar de turno o si la partida ha terminado.
 *
 * Lo usan tanto la validación como el bot, para que no puedan interpretar las
 * reglas de forma distinta.
 */
export function advance(board: Board, side: Side, move: Move): Advance {
  const applied = applyMoveToBoard(board, move);

  // Comer y poder seguir comiendo obliga a encadenar con la misma pieza.
  // Coronar corta la cadena aunque quedaran capturas.
  const chains =
    move.captured.length > 0 &&
    !applied.crowned &&
    capturesFrom(applied.board, move.to).length > 0;

  if (chains) {
    return {
      board: applied.board,
      chainFrom: move.to,
      turn: side,
      winner: null,
      finished: false,
    };
  }

  // Pierde quien se queda sin piezas o sin ningún movimiento legal.
  const rival = other(side);
  const lost =
    countPieces(applied.board, rival) === 0 ||
    legalMoves(applied.board, rival, null).length === 0;

  return {
    board: applied.board,
    chainFrom: null,
    turn: lost ? null : rival,
    winner: lost ? side : null,
    finished: lost,
  };
}

export const cellLabel = (i: number) =>
  `${"abcdefgh"[col(i)]}${SIZE - row(i)}`;
