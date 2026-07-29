import { battleship } from "@/lib/games/battleship/module";
import { connect4 } from "@/lib/games/connect4/module";
import { tictactoe } from "@/lib/games/tictactoe/module";
import type { GameModule } from "@/lib/games/types";

/**
 * Registro de juegos. Añadir uno nuevo es escribir su módulo y sumarlo aquí:
 * la sala, los turnos, Realtime y la revancha ya funcionan para todos.
 */
// Del más rápido al más largo: el primero de la lista es el más fácil de picar.
export const GAMES = [tictactoe, connect4, battleship] as const;

export type GameId = (typeof GAMES)[number]["id"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function gameById(id: string | null | undefined): GameModule<any, any> | undefined {
  if (!id) return undefined;
  return GAMES.find((g) => g.id === id);
}

export function isGameId(id: unknown): id is GameId {
  return typeof id === "string" && GAMES.some((g) => g.id === id);
}
