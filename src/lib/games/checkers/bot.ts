import { bestMove, type Difficulty, type Searchable } from "@/lib/games/bot/minimax";
import type { CheckersMove, CheckersState } from "@/lib/games/checkers/module";
import {
  advance,
  CELLS,
  col,
  legalMoves,
  type Move,
  row,
  SIZE,
} from "@/lib/games/checkers/rules";
import { type BotLevel, other, type Side } from "@/lib/games/types";

const LEVELS: Record<BotLevel, Difficulty> = {
  easy: { depth: 1, blunder: 0.45 },
  medium: { depth: 4, blunder: 0.12 },
  hard: { depth: 6, blunder: 0 },
};

const MAN = 100;
/** La dama vuela por toda la diagonal, así que vale bastante más que un peón. */
const KING = 260;

/**
 * Se busca sobre el movimiento completo —con las casillas comidas dentro— en
 * vez de sobre `{from, to}`. Así no hay que recalcular la captura en cada nodo.
 */
const searchable: Searchable<CheckersState, Move> = {
  moves: (state, side) => legalMoves(state.board, side, state.chainFrom),

  play(state, side, move) {
    const next = advance(state.board, side, move);
    return {
      state: { board: next.board, chainFrom: next.chainFrom, lastMove: move },
      turn: next.turn,
      winner: next.winner,
      finished: next.finished,
    };
  },

  evaluate(state, me) {
    let score = 0;

    for (let i = 0; i < CELLS; i++) {
      const piece = state.board[i];
      if (!piece) continue;

      let value = piece.king ? KING : MAN;

      if (!piece.king) {
        // Cuanto más cerca de coronar, más vale el peón.
        const advanced = piece.side === "host" ? SIZE - 1 - row(i) : row(i);
        value += advanced * 9;
      }
      // En los bordes no se la pueden comer.
      if (col(i) === 0 || col(i) === SIZE - 1) value += 6;

      score += piece.side === me ? value : -value;
    }

    // Con ventaja material conviene cambiar piezas; con desventaja, evitarlo.
    const mine = state.board.filter((p) => p?.side === me).length;
    const theirs = state.board.filter((p) => p?.side === other(me)).length;
    if (mine > theirs) score += (24 - mine - theirs) * 4;

    return score;
  },
};

export function checkersBot(
  state: CheckersState,
  side: Side,
  level: BotLevel,
): CheckersMove | null {
  const move = bestMove(searchable, state, side, LEVELS[level]);
  return move ? { type: "move", from: move.from, to: move.to } : null;
}
