import type { GameModule } from "@/lib/games/types";
import type { BotLevel, Side } from "@/lib/games/types";

/** Situación de la partida tras aplicar una o varias jugadas. */
export type Progress = {
  state: unknown;
  turn: Side | null;
  winner: Side | null;
  finished: boolean;
};

/** Tope de seguridad por si un juego devolviera turnos en bucle. */
const MAX_TURNS = 200;

/**
 * Juega todos los turnos seguidos que le correspondan al bot. Son varios
 * cuando el juego encadena —una cadena de capturas, un tiro extra por
 * acertar—, así que se repite hasta que le toque al humano o se acabe.
 */
export function playBotTurns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  module: GameModule<any, any>,
  botSide: Side,
  level: BotLevel,
  from: Progress,
): Progress {
  if (!module.bot) return from;

  let progress = from;
  for (let i = 0; i < MAX_TURNS; i++) {
    if (progress.finished) break;
    // Actúa en su turno y también cuando no hay turno de nadie: colocar la
    // flota es una fase sin turnos en la que los dos jugadores preparan a la
    // vez. Si no tiene nada que hacer, el propio bot devuelve null y se corta.
    if (progress.turn !== null && progress.turn !== botSide) break;

    const move = module.bot(progress.state, botSide, level);
    if (!move) break;

    const result = module.applyMove(progress.state, botSide, move);
    // Un bot que propone algo ilegal es un fallo del juego, no del jugador:
    // se deja la partida como estaba en vez de romper la petición.
    if (!result.ok) break;

    progress = {
      state: result.state,
      turn: result.turn,
      winner: result.winner,
      finished: result.finished,
    };
  }

  return progress;
}
