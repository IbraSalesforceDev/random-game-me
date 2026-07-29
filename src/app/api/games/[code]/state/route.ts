import { NextResponse } from "next/server";
import { toPlayerView } from "@/lib/server/games";
import { isResponse, loadGameForToken } from "@/lib/server/load";

export const dynamic = "force-dynamic";

/** Estado de la partida filtrado para el jugador que pregunta. */
export async function GET(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const token = new URL(request.url).searchParams.get("token");

  const loaded = await loadGameForToken(code, token);
  if (isResponse(loaded)) return loaded;

  return NextResponse.json({ view: toPlayerView(loaded.game, loaded.side) });
}
