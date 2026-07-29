import { NextResponse } from "next/server";
import { gameById, isGameId } from "@/lib/games";
import { type GameRow, toPlayerView } from "@/lib/server/games";
import { isResponse, loadGameForToken } from "@/lib/server/load";
import { broadcastGameUpdate, supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/** Elige a qué se juega. Vale cualquiera de los dos: el primero que toque. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const token: string | null = typeof body?.token === "string" ? body.token : null;

  const loaded = await loadGameForToken(code, token);
  if (isResponse(loaded)) return loaded;
  const { game: row, side } = loaded;

  if (row.status !== "choosing") {
    return NextResponse.json({ error: "Ahora no toca elegir juego" }, { status: 409 });
  }
  if (!isGameId(body?.game)) {
    return NextResponse.json({ error: "Ese juego no existe" }, { status: 400 });
  }

  const module = gameById(body.game)!;

  // El filtro por `version` resuelve el empate si los dos eligen a la vez:
  // gana quien llegue primero y el otro recibe la partida ya empezada.
  const { data, error } = await supabaseAdmin()
    .from("games")
    .update({
      game: module.id,
      state: module.createState(),
      turn: module.initialTurn(),
      status: "playing",
      winner: null,
      version: row.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("code", row.code)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "No se pudo elegir el juego" }, { status: 500 });

  if (!data) {
    const retry = await loadGameForToken(code, token);
    if (isResponse(retry)) return retry;
    return NextResponse.json({ view: toPlayerView(retry.game, retry.side) });
  }

  await broadcastGameUpdate(row.code);
  return NextResponse.json({ view: toPlayerView(data as GameRow, side) });
}
