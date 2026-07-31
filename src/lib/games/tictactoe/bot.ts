import { bestMove, type Difficulty, type Searchable } from "@/lib/games/bot/minimax";
import type { TicTacToeMove, TicTacToeState } from "@/lib/games/tictactoe/module";
import { CELLS, isFull, LINES, winningLine } from "@/lib/games/tictactoe/rules";
import { type BotLevel, other, type Side } from "@/lib/games/types";

/**
 * El tres en raya está resuelto: a plena profundidad el bot es imbatible. La
 * dificultad va casi toda en cuántas veces se despista a propósito.
 */
const LEVELS: Record<BotLevel, Difficulty> = {
  easy: { depth: 1, blunder: 0.55 },
  medium: { depth: 9, blunder: 0.25 },
  hard: { depth: 9, blunder: 0 },
};

const searchable: Searchable<TicTacToeState, TicTacToeMove> = {
  moves: (state) =>
    [...Array(CELLS).keys()]
      .filter((cell) => state.cells[cell] === null)
      .map((cell) => ({ type: "mark", cell })),

  play(state, side, move) {
    const cells = state.cells.map((c, i) => (i === move.cell ? side : c));
    const line = winningLine(cells);
    const draw = !line && isFull(cells);
    return {
      state: { cells, lastMove: move.cell, winningLine: line },
      turn: line || draw ? null : other(side),
      winner: line ? side : null,
      finished: Boolean(line) || draw,
    };
  },

  /** Sólo cuenta en nivel fácil, que corta la búsqueda enseguida. */
  evaluate(state, me) {
    const rival = other(me);
    let score = 0;
    for (const [a, b, c] of LINES) {
      const trio = [state.cells[a], state.cells[b], state.cells[c]];
      const mias = trio.filter((v) => v === me).length;
      const suyas = trio.filter((v) => v === rival).length;
      // Una línea con piezas de los dos ya no sirve a nadie.
      if (mias > 0 && suyas > 0) continue;
      score += mias * mias - suyas * suyas;
    }
    return score;
  },
};

export function tictactoeBot(
  state: TicTacToeState,
  side: Side,
  level: BotLevel,
): TicTacToeMove | null {
  return bestMove(searchable, state, side, LEVELS[level]);
}
