import { NextResponse } from "next/server";
import { type GameRow, toPlayerView } from "@/lib/server/games";
import { isResponse, loadGameForToken } from "@/lib/server/load";
import { broadcastGameUpdate, supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/** Revancha: mismos jugadores y mismo código, tableros a cero. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const token: string | null = typeof body?.token === "string" ? body.token : null;

  const loaded = await loadGameForToken(code, token);
  if (isResponse(loaded)) return loaded;
  const { game, side } = loaded;

  // Si el rival ya pulsó revancha, la partida ya está reiniciada: no es un error.
  if (game.status === "placing") {
    return NextResponse.json({ view: toPlayerView(game, side) });
  }
  if (game.status !== "finished") {
    return NextResponse.json({ error: "La partida aún no ha terminado" }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin()
    .from("games")
    .update({
      status: "placing",
      host_ships: null,
      guest_ships: null,
      host_shots: [],
      guest_shots: [],
      turn: null,
      winner: null,
      version: game.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("code", game.code)
    .eq("version", game.version)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "No se pudo reiniciar" }, { status: 500 });
  // Sin fila: el rival ya pidió la revancha, así que el estado ya está reiniciado.
  if (!data) {
    const retry = await loadGameForToken(code, token);
    if (isResponse(retry)) return retry;
    return NextResponse.json({ view: toPlayerView(retry.game, retry.side) });
  }

  await broadcastGameUpdate(game.code);
  return NextResponse.json({ view: toPlayerView(data as GameRow, side) });
}
