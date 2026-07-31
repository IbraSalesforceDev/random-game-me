import type { Side } from "@/lib/games/types";

/**
 * Lo que necesita el buscador para explorar un juego. Deliberadamente no
 * asume que los turnos se alternen: `play` devuelve a quién le toca, así que
 * una cadena de capturas o un tiro extra encajan sin tocar nada.
 */
export type Searchable<S, M> = {
  moves(state: S, side: Side): M[];
  play(
    state: S,
    side: Side,
    move: M,
  ): { state: S; turn: Side | null; winner: Side | null; finished: boolean };
  /** Puntuación de la posición desde el punto de vista de `me`. */
  evaluate(state: S, me: Side): number;
};

/** Ganar cuanto antes vale más que ganar tarde, y perder tarde menos mal. */
const WIN = 1_000_000;
const terminalScore = (winner: Side | null, me: Side, depthLeft: number) => {
  if (!winner) return 0; // tablas
  return winner === me ? WIN + depthLeft : -(WIN + depthLeft);
};

function scoreNode<S, M>(
  game: Searchable<S, M>,
  state: S,
  turn: Side,
  me: Side,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth <= 0) return game.evaluate(state, me);

  const moves = game.moves(state, turn);
  // Sin movimientos legales la posición ya no da más de sí.
  if (moves.length === 0) return game.evaluate(state, me);

  const maximizing = turn === me;
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const next = game.play(state, turn, move);
    const value = next.finished
      ? terminalScore(next.winner, me, depth)
      : scoreNode(game, next.state, next.turn ?? turn, me, depth - 1, alpha, beta);

    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break; // poda alfa-beta
  }

  return best;
}

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export type Difficulty = {
  /** Jugadas que mira por delante. */
  depth: number;
  /** Probabilidad de tirar al azar en vez de jugar lo mejor. */
  blunder: number;
};

/**
 * Mejor movimiento para `me`. Entre varios igual de buenos elige al azar, para
 * que el bot no repita siempre la misma partida.
 */
export function bestMove<S, M>(
  game: Searchable<S, M>,
  state: S,
  me: Side,
  { depth, blunder }: Difficulty,
): M | null {
  const moves = game.moves(state, me);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  // Así se gradúa la dificultad: un bot fácil se despista de vez en cuando.
  if (blunder > 0 && Math.random() < blunder) return pick(moves);

  let bestScore = -Infinity;
  let bestMoves: M[] = [];

  for (const move of moves) {
    const next = game.play(state, me, move);
    const value = next.finished
      ? terminalScore(next.winner, me, depth)
      : scoreNode(game, next.state, next.turn ?? me, me, depth - 1, -Infinity, Infinity);

    if (value > bestScore) {
      bestScore = value;
      bestMoves = [move];
    } else if (value === bestScore) {
      bestMoves.push(move);
    }
  }

  return pick(bestMoves);
}
