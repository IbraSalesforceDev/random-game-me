import { NextResponse } from "next/server";
import {
  type GameRow,
  generateToken,
  normalizeCode,
  sideForToken,
  toPlayerView,
} from "@/lib/server/games";
import { broadcastGameUpdate, supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/**
 * Entra en una partida por código. Si el token ya pertenece a la partida
 * simplemente reconecta (por ejemplo al recargar la página).
 */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await ctx.params).code);
  const body = await request.json().catch(() => ({}));
  const token: string | null = typeof body?.token === "string" ? body.token : null;

  const db = supabaseAdmin();
  const { data, error } = await db.from("games").select("*").eq("code", code).maybeSingle();

  if (error) return NextResponse.json({ error: "Error al leer la partida" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Esa partida no existe" }, { status: 404 });

  const game = data as GameRow;

  const existingSide = sideForToken(game, token);
  if (existingSide) {
    return NextResponse.json({ token, view: toPlayerView(game, existingSide) });
  }

  if (game.guest_token) {
    return NextResponse.json({ error: "La partida ya está completa" }, { status: 409 });
  }

  const guestToken = generateToken();
  // El filtro por guest_token nulo evita que dos personas entren a la vez.
  const { data: updated, error: joinError } = await db
    .from("games")
    .update({ guest_token: guestToken, status: "choosing", updated_at: new Date().toISOString() })
    .eq("code", code)
    .is("guest_token", null)
    .select("*")
    .maybeSingle();

  if (joinError) return NextResponse.json({ error: "No se pudo entrar" }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "La partida ya está completa" }, { status: 409 });

  await broadcastGameUpdate(code);
  return NextResponse.json({
    token: guestToken,
    view: toPlayerView(updated as GameRow, "guest"),
  });
}
