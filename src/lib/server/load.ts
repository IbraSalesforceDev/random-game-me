import { NextResponse } from "next/server";
import { type GameRow, normalizeCode, type Side, sideForToken } from "@/lib/server/games";
import { supabaseAdmin } from "@/lib/server/supabase";

export type Loaded = { game: GameRow; side: Side };

/**
 * Carga la partida y comprueba que el token pertenece a uno de los dos jugadores.
 * Devuelve una respuesta de error lista para retornar si algo no cuadra.
 */
export async function loadGameForToken(
  rawCode: string,
  token: string | null,
): Promise<Loaded | NextResponse> {
  const code = normalizeCode(rawCode);
  const db = supabaseAdmin();

  const { data, error } = await db.from("games").select("*").eq("code", code).maybeSingle();

  if (error) return NextResponse.json({ error: "Error al leer la partida" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });

  const game = data as GameRow;
  const side = sideForToken(game, token);
  if (!side) return NextResponse.json({ error: "No juegas esta partida" }, { status: 403 });

  return { game, side };
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
