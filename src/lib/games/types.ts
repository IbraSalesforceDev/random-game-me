export type Side = "host" | "guest";

export const other = (side: Side): Side => (side === "host" ? "guest" : "host");

/** Resultado de intentar aplicar un movimiento. */
export type MoveResult<S> =
  | {
      ok: true;
      state: S;
      /** A quién le toca ahora. `null` si el juego no está en fase de turnos. */
      turn: Side | null;
      /** Ganador, o `null` si la partida sigue o acabó en tablas. */
      winner: Side | null;
      finished: boolean;
    }
  | { ok: false; error: string };

/**
 * Lo que cada juego tiene que implementar. Todo lo demás —salas por código,
 * los dos jugadores, Realtime, revancha— es común y vive fuera de aquí.
 *
 * `S` es el estado interno del juego y viaja como jsonb en la base de datos:
 * cada juego le da la forma que quiera. `M` es la forma de un movimiento.
 */
export type GameModule<S = unknown, M = unknown> = {
  id: string;
  name: string;
  emoji: string;
  /** Frase corta para la pantalla de selección. */
  tagline: string;

  createState(): S;

  /**
   * Turno inicial. `null` cuando el juego arranca con una fase sin turnos,
   * como colocar la flota, en la que los dos actúan a la vez.
   */
  initialTurn(): Side | null;

  /**
   * Estado tal y como puede verlo un jugador. Aquí es donde se oculta lo que
   * el rival no debe saber; un juego con todo a la vista puede devolverlo tal
   * cual.
   */
  toView(state: S, side: Side): unknown;

  /** Valida y aplica un movimiento. Nunca debe modificar `state`. */
  applyMove(state: S, side: Side, move: M): MoveResult<S>;

  /**
   * Elige el movimiento del bot. Es opcional: un juego que no la implemente
   * simplemente no aparece cuando se juega en solitario.
   */
  bot?(state: S, side: Side, level: BotLevel): M | null;
};

export const BOT_LEVELS = ["easy", "medium", "hard"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export const BOT_LABEL: Record<BotLevel, string> = {
  easy: "Fácil",
  medium: "Normal",
  hard: "Difícil",
};

export function isBotLevel(v: unknown): v is BotLevel {
  return typeof v === "string" && (BOT_LEVELS as readonly string[]).includes(v);
}

/** Ayuda a conservar los tipos al declarar un módulo. */
export function defineGame<S, M>(module: GameModule<S, M>): GameModule<S, M> {
  return module;
}
