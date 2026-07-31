import { NextResponse } from "next/server";
import { gameById } from "@/lib/games";
import { playBotTurns } from "@/lib/server/bot";
import { botSideOf, emptyTally, type GameRow, toPlayerView } from "@/lib/server/games";
import { isResponse, loadGameForToken } from "@/lib/server/load";
import { broadcastGameUpdate, supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/**
 * Única ruta de juego: valida quién eres y en qué partida estás, y delega la
 * regla concreta al módulo del juego elegido.
 */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const token: string | null = typeof body?.token === "string" ? body.token : null;

  const loaded = await loadGameForToken(code, token);
  if (isResponse(loaded)) return loaded;
  const { game: row, side } = loaded;

  if (row.status !== "playing") {
    return NextResponse.json({ error: "La partida no está en juego" }, { status: 409 });
  }

  const module = gameById(row.game);
  if (!module || !row.state) {
    return NextResponse.json({ error: "Esta partida no tiene juego" }, { status: 409 });
  }

  // El turno lo comprueba el módulo: hay fases, como colocar la flota, en las
  // que los dos jugadores actúan a la vez.
  if (row.turn !== null && row.turn !== side) {
    return NextResponse.json({ error: "No es tu turno" }, { status: 409 });
  }

  const result = module.applyMove(row.state, side, body?.move);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // En solitario el bot responde dentro de la misma petición, de modo que el
  // jugador recibe ya la jugada del rival y no hace falta esperar a un sondeo.
  const botSide = botSideOf(row);
  const run =
    botSide && row.bot_level
      ? playBotTurns(module, botSide, row.bot_level, result)
      : { progress: result, steps: [] };
  const progress = run.progress;

  // El marcador se apunta en la misma escritura que el movimiento, así que el
  // filtro por `version` también lo protege de contarse dos veces.
  const scores = { ...(row.scores ?? {}) };
  if (progress.finished) {
    const tally = { ...(scores[module.id] ?? emptyTally()) };
    if (progress.winner) tally[progress.winner] += 1;
    else tally.draws += 1;
    scores[module.id] = tally;
  }

  // El filtro por `version` hace que dos movimientos simultáneos no se pisen.
  const { data, error } = await supabaseAdmin()
    .from("games")
    .update({
      state: progress.state,
      turn: progress.turn,
      winner: progress.winner,
      status: progress.finished ? "finished" : "playing",
      scores,
      version: row.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("code", row.code)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "No se pudo jugar" }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "La partida cambió, inténtalo de nuevo" }, { status: 409 });
  }

  await broadcastGameUpdate(row.code);

  const saved = data as GameRow;
  // Sólo se guarda la posición final, pero se devuelve el camino hasta ella:
  // primero tu jugada y después cada una del bot, la última incluida. El
  // cliente las enseña con pausa, que si no una cadena de capturas se ve como
  // un salto sin más.
  const replay = [result, ...run.steps].map((step) =>
    toPlayerView(
      {
        ...saved,
        state: step.state,
        turn: step.turn,
        winner: step.winner,
        status: step.finished ? "finished" : "playing",
      },
      side,
    ),
  );

  return NextResponse.json({ view: toPlayerView(saved, side), replay });
}
