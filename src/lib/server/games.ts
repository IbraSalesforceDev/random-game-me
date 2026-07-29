import {
  FLEET,
  resolveShots,
  type ResolvedShot,
  type Ship,
  type Shot,
  sunkShips,
} from "@/lib/battleship";

export type Side = "host" | "guest";
export type GameStatus = "waiting" | "placing" | "playing" | "finished";

export type GameRow = {
  code: string;
  status: GameStatus;
  host_token: string;
  guest_token: string | null;
  host_ships: Ship[] | null;
  guest_ships: Ship[] | null;
  host_shots: Shot[];
  guest_shots: Shot[];
  turn: Side | null;
  winner: Side | null;
  /** Contador optimista: evita que dos escrituras simultáneas se pisen. */
  version: number;
  created_at: string;
  updated_at: string;
};

/** Vista de la partida que sí puede ver un jugador: nunca incluye la flota rival. */
export type PlayerView = {
  code: string;
  status: GameStatus;
  you: Side;
  yourTurn: boolean;
  winner: "you" | "opponent" | null;
  opponentJoined: boolean;
  yourFleetReady: boolean;
  opponentFleetReady: boolean;
  /** Tu flota tal y como la colocaste. */
  yourShips: Ship[];
  /** Disparos del rival contra tu tablero. */
  shotsAgainstYou: ResolvedShot[];
  /** Tus disparos contra el tablero rival. */
  yourShots: ResolvedShot[];
  /** Barcos tuyos hundidos (ids). */
  yourSunk: string[];
  /** Barcos rivales hundidos: se revela su posición al hundirse. */
  opponentSunk: Ship[];
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
export function sideForToken(game: GameRow, token: string | null): Side | null {
  if (!token) return null;
  if (token === game.host_token) return "host";
  if (game.guest_token && token === game.guest_token) return "guest";
  return null;
}

export const other = (side: Side): Side => (side === "host" ? "guest" : "host");

export function shipsOf(game: GameRow, side: Side): Ship[] | null {
  return side === "host" ? game.host_ships : game.guest_ships;
}

export function shotsOf(game: GameRow, side: Side): Shot[] {
  return (side === "host" ? game.host_shots : game.guest_shots) ?? [];
}

export function toPlayerView(game: GameRow, side: Side): PlayerView {
  const rival = other(side);
  const yourShips = shipsOf(game, side) ?? [];
  const opponentShips = shipsOf(game, rival) ?? [];

  // Tus disparos van contra la flota rival y viceversa.
  const yourShots = resolveShots(opponentShips, shotsOf(game, side));
  const shotsAgainstYou = resolveShots(yourShips, shotsOf(game, rival));

  return {
    code: game.code,
    status: game.status,
    you: side,
    yourTurn: game.status === "playing" && game.turn === side,
    winner: game.winner ? (game.winner === side ? "you" : "opponent") : null,
    opponentJoined: Boolean(game.guest_token),
    yourFleetReady: Boolean(shipsOf(game, side)),
    opponentFleetReady: Boolean(shipsOf(game, rival)),
    yourShips,
    shotsAgainstYou,
    yourShots,
    yourSunk: sunkShips(yourShips, shotsOf(game, rival)).map((s) => s.id),
    opponentSunk: sunkShips(opponentShips, shotsOf(game, side)),
    updatedAt: game.updated_at,
  };
}

export const FLEET_SIZE = FLEET.length;
