import { NextResponse } from "next/server";
import { gameById } from "@/lib/games";
import { type GameRow, toPlayerView } from "@/lib/server/games";
import { isResponse, loadGameForToken } from "@/lib/server/load";
import { broadcastGameUpdate, supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/**
 * Reinicia la sala sin echar a nadie. Con `replay` se repite el mismo juego;
 * sin él se vuelve al selector para cambiar de juego.
 */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const token: string | null = typeof body?.token === "string" ? body.token : null;
  const replay = body?.replay === true;

  const loaded = await loadGameForToken(code, token);
  if (isResponse(loaded)) return loaded;
  const { game, side } = loaded;

  // Si el rival se adelantó, la sala ya está reiniciada: no es un error.
  if (game.status === "choosing" || game.status === "playing") {
    return NextResponse.json({ view: toPlayerView(game, side) });
  }
  if (game.status !== "finished") {
    return NextResponse.json({ error: "La partida aún no ha terminado" }, { status: 409 });
  }

  const module = replay ? gameById(game.game) : undefined;

  const patch = module
    ? {
        // Otra del mismo juego: se salta el selector y empieza directo.
        status: "playing" as const,
        game: module.id,
        state: module.createState(),
        turn: module.initialTurn(),
      }
    : {
        status: "choosing" as const,
        game: null,
        state: null,
        turn: null,
      };

  const { data, error } = await supabaseAdmin()
    .from("games")
    .update({
      ...patch,
      winner: null,
      version: game.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("code", game.code)
    .eq("version", game.version)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "No se pudo reiniciar" }, { status: 500 });
  // Sin fila: el rival reinició primero, así que se devuelve lo que hay.
  if (!data) {
    const retry = await loadGameForToken(code, token);
    if (isResponse(retry)) return retry;
    return NextResponse.json({ view: toPlayerView(retry.game, retry.side) });
  }

  await broadcastGameUpdate(game.code);
  return NextResponse.json({ view: toPlayerView(data as GameRow, side) });
}
