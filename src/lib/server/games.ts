import { gameById } from "@/lib/games";
import type { BotLevel } from "@/lib/games/types";
import { other, type Side } from "@/lib/games/types";

export { other };
export type { Side };

/**
 * Estados de la sala. Todo lo que sea propio de un juego —colocar la flota,
 * por ejemplo— vive dentro de `state`, no aquí.
 */
export type GameStatus = "waiting" | "choosing" | "playing" | "finished";

export type GameRow = {
  code: string;
  status: GameStatus;
  host_token: string;
  guest_token: string | null;
  /** Juego elegido, o null mientras deciden. */
  game: string | null;
  /** Estado interno del juego, con la forma que decida su módulo. */
  state: unknown;
  turn: Side | null;
  winner: Side | null;
  /** Partidas ganadas en esta sala, por juego. Sobrevive a las revanchas. */
  scores: Record<string, Tally> | null;
  /** Nivel del bot si la sala es en solitario; null si juegan dos personas. */
  bot_level: BotLevel | null;
  /** Contador optimista: evita que dos escrituras simultáneas se pisen. */
  version: number;
  created_at: string;
  updated_at: string;
};

/** Recuento de una sala para un juego concreto. */
export type Tally = { host: number; guest: number; draws: number };

export const emptyTally = (): Tally => ({ host: 0, guest: 0, draws: 0 });

/** El marcador visto desde un jugador: siempre «tú» a la izquierda. */
export type PlayerTally = { you: number; opponent: number; draws: number };

/** Lo que se le manda a un jugador. Nunca incluye datos ocultos del rival. */
export type PlayerView = {
  code: string;
  status: GameStatus;
  you: Side;
  yourTurn: boolean;
  outcome: "won" | "lost" | "draw" | null;
  opponentJoined: boolean;
  game: string | null;
  gameName: string | null;
  /** Estado del juego filtrado por su módulo, o null si aún no hay juego. */
  gameView: unknown;
  /** Marcador de la sala por juego, ya orientado a este jugador. */
  scores: Record<string, PlayerTally>;
  /** Nivel del bot, o null si el rival es una persona. */
  botLevel: BotLevel | null;
  updatedAt: string;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1

export function generateCode(length = 4): string {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function generateToken(): string {
  return crypto.randomUUID();
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Devuelve de qué lado juega el token, o null si no pertenece a la partida. */
export function sideForToken(row: GameRow, token: string | null): Side | null {
  if (!token) return null;
  if (token === row.host_token) return "host";
  if (row.guest_token && token === row.guest_token) return "guest";
  return null;
}

function outcomeFor(row: GameRow, side: Side): PlayerView["outcome"] {
  if (row.status !== "finished") return null;
  if (!row.winner) return "draw";
  return row.winner === side ? "won" : "lost";
}

/** Da la vuelta al marcador para que «tú» sea siempre quien pregunta. */
function scoresFor(row: GameRow, side: Side): Record<string, PlayerTally> {
  const rival = other(side);
  const out: Record<string, PlayerTally> = {};
  for (const [gameId, tally] of Object.entries(row.scores ?? {})) {
    out[gameId] = { you: tally[side], opponent: tally[rival], draws: tally.draws };
  }
  return out;
}

/** En las salas en solitario el bot siempre juega de invitado. */
export const botSideOf = (row: GameRow): Side | null => (row.bot_level ? "guest" : null);

export function toPlayerView(row: GameRow, side: Side): PlayerView {
  const module = gameById(row.game);

  return {
    scores: scoresFor(row, side),
    botLevel: row.bot_level,
    code: row.code,
    status: row.status,
    you: side,
    yourTurn: row.status === "playing" && row.turn === side,
    outcome: outcomeFor(row, side),
    opponentJoined: Boolean(row.guest_token),
    game: row.game,
    gameName: module?.name ?? null,
    gameView: module && row.state ? module.toView(row.state, side) : null,
    updatedAt: row.updated_at,
  };
}
