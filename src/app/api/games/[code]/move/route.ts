import { NextResponse } from "next/server";
import { gameById } from "@/lib/games";
import { emptyTally, type GameRow, toPlayerView } from "@/lib/server/games";
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

  // El marcador se apunta en la misma escritura que el movimiento, así que el
  // filtro por `version` también lo protege de contarse dos veces.
  const scores = { ...(row.scores ?? {}) };
  if (result.finished) {
    const tally = { ...(scores[module.id] ?? emptyTally()) };
    if (result.winner) tally[result.winner] += 1;
    else tally.draws += 1;
    scores[module.id] = tally;
  }

  // El filtro por `version` hace que dos movimientos simultáneos no se pisen.
  const { data, error } = await supabaseAdmin()
    .from("games")
    .update({
      state: result.state,
      turn: result.turn,
      winner: result.winner,
      status: result.finished ? "finished" : "playing",
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
  return NextResponse.json({ view: toPlayerView(data as GameRow, side) });
}
