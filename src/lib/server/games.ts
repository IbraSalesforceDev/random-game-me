import { gameById } from "@/lib/games";
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
  /** Contador optimista: evita que dos escrituras simultáneas se pisen. */
  version: number;
  created_at: string;
  updated_at: string;
};

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

export function toPlayerView(row: GameRow, side: Side): PlayerView {
  const module = gameById(row.game);

  return {
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
