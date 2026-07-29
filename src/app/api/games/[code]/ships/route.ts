import { NextResponse } from "next/server";
import { validateFleet } from "@/lib/battleship";
import { type GameRow, other, shipsOf, toPlayerView } from "@/lib/server/games";
import { isResponse, loadGameForToken } from "@/lib/server/load";
import { broadcastGameUpdate, supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/** Confirma la colocación de la flota. Cuando los dos han colocado, empieza la partida. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const token: string | null = typeof body?.token === "string" ? body.token : null;

  const loaded = await loadGameForToken(code, token);
  if (isResponse(loaded)) return loaded;
  const { game, side } = loaded;

  if (game.status !== "placing") {
    return NextResponse.json(
      { error: "Ahora mismo no se puede colocar la flota" },
      { status: 409 },
    );
  }
  if (shipsOf(game, side)) {
    return NextResponse.json({ error: "Ya has confirmado tu flota" }, { status: 409 });
  }
  if (!validateFleet(body?.ships)) {
    return NextResponse.json({ error: "Colocación de barcos no válida" }, { status: 400 });
  }

  const opponentReady = Boolean(shipsOf(game, other(side)));
  const patch: Record<string, unknown> = {
    [side === "host" ? "host_ships" : "guest_ships"]: body.ships,
    updated_at: new Date().toISOString(),
  };

  if (opponentReady) {
    patch.status = "playing";
    // Empieza quien no colocó primero, para compensar la espera.
    patch.turn = side;
  }

  const { data, error } = await supabaseAdmin()
    .from("games")
    .update(patch)
    .eq("code", game.code)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "No se pudo guardar la flota" }, { status: 500 });
  }

  await broadcastGameUpdate(game.code);
  return NextResponse.json({ view: toPlayerView(data as GameRow, side) });
}
