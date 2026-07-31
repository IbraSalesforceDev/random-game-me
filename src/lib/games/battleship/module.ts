import {
  allSunk,
  BOARD_SIZE,
  cellKey,
  isHit,
  resolveShots,
  type ResolvedShot,
  type Ship,
  type Shot,
  shipCells,
  sunkShips,
  validateFleet,
} from "@/lib/games/battleship/rules";
import { battleshipBot } from "@/lib/games/battleship/bot";
import { defineGame, type MoveResult, other, type Side } from "@/lib/games/types";

/**
 * La colocación de la flota es una fase interna del juego, no de la sala: los
 * dos jugadores actúan a la vez y sin turnos hasta que ambos han confirmado.
 */
export type BattleshipState = {
  phase: "placing" | "battle";
  ships: { host: Ship[] | null; guest: Ship[] | null };
  shots: { host: Shot[]; guest: Shot[] };
};

export type BattleshipMove =
  | { type: "ships"; ships: unknown }
  | { type: "fire"; x: number; y: number };

export type BattleshipView = {
  phase: "placing" | "battle";
  yourFleetReady: boolean;
  opponentFleetReady: boolean;
  yourShips: Ship[];
  /** Disparos del rival contra tu tablero. */
  shotsAgainstYou: ResolvedShot[];
  /** Tus disparos contra el tablero rival. */
  yourShots: ResolvedShot[];
  yourSunk: string[];
  /** Barcos rivales hundidos: al hundirse se revela su posición. */
  opponentSunk: Ship[];
};

const isCoord = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;

export const battleship = defineGame<BattleshipState, BattleshipMove>({
  id: "battleship",
  name: "Hundir la flota",
  emoji: "🚢",
  tagline: "Coloca tus barcos y adivina dónde están los suyos.",

  createState: () => ({
    phase: "placing",
    ships: { host: null, guest: null },
    shots: { host: [], guest: [] },
  }),

  // Nadie tiene turno mientras los dos colocan su flota.
  initialTurn: () => null,

  toView(state, side): BattleshipView {
    const rival = other(side);
    const yourShips = state.ships[side] ?? [];
    const opponentShips = state.ships[rival] ?? [];

    return {
      phase: state.phase,
      yourFleetReady: Boolean(state.ships[side]),
      opponentFleetReady: Boolean(state.ships[rival]),
      yourShips,
      // Tus disparos van contra la flota rival y viceversa.
      yourShots: resolveShots(opponentShips, state.shots[side]),
      shotsAgainstYou: resolveShots(yourShips, state.shots[rival]),
      yourSunk: sunkShips(yourShips, state.shots[rival]).map((s) => s.id),
      opponentSunk: sunkShips(opponentShips, state.shots[side]),
    };
  },

  bot: battleshipBot,

  applyMove(state, side, move): MoveResult<BattleshipState> {
    if (move?.type === "ships") return placeFleet(state, side, move.ships);
    if (move?.type === "fire") return fire(state, side, move);
    return { ok: false, error: "Movimiento desconocido" };
  },
});

function placeFleet(
  state: BattleshipState,
  side: Side,
  ships: unknown,
): MoveResult<BattleshipState> {
  if (state.phase !== "placing") {
    return { ok: false, error: "Ahora mismo no se puede colocar la flota" };
  }
  if (state.ships[side]) return { ok: false, error: "Ya has confirmado tu flota" };
  if (!validateFleet(ships)) return { ok: false, error: "Colocación de barcos no válida" };

  const next: BattleshipState = {
    ...state,
    ships: { ...state.ships, [side]: ships },
  };

  // Cuando los dos han colocado empieza la batalla. Abre quien colocó el
  // segundo, para compensar la espera del primero.
  const bothReady = Boolean(next.ships.host && next.ships.guest);
  if (bothReady) next.phase = "battle";

  return {
    ok: true,
    state: next,
    turn: bothReady ? side : null,
    winner: null,
    finished: false,
  };
}

function fire(
  state: BattleshipState,
  side: Side,
  { x, y }: { x: number; y: number },
): MoveResult<BattleshipState> {
  if (state.phase !== "battle") {
    return { ok: false, error: "Todavía estáis colocando la flota" };
  }
  if (!isCoord(x) || !isCoord(y)) return { ok: false, error: "Casilla no válida" };

  const mine = state.shots[side];
  if (mine.some((s) => cellKey(s.x, s.y) === cellKey(x, y))) {
    return { ok: false, error: "Ya has disparado ahí" };
  }

  const rival = other(side);
  const opponentShips = state.ships[rival] ?? [];
  const hit = isHit(opponentShips, x, y);
  const shots = [...mine, { x, y }];
  const won = hit && allSunk(opponentShips, shots);

  return {
    ok: true,
    state: { ...state, shots: { ...state.shots, [side]: shots } },
    // Acertar da otro tiro; fallar cede el turno.
    turn: won ? null : hit ? side : rival,
    winner: won ? side : null,
    finished: won,
  };
}

export { shipCells, type Ship };
