import { NextResponse } from "next/server";
import { isBotLevel } from "@/lib/games/types";
import { generateCode, generateToken } from "@/lib/server/games";
import { supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/**
 * Crea una partida y devuelve el código de sala y el token del anfitrión.
 * Con `level` la sala es en solitario: el hueco de invitado queda ocupado por
 * el bot y se pasa directo a elegir juego, sin esperar a nadie.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const level = isBotLevel(body?.level) ? body.level : null;

  const db = supabaseAdmin();
  const token = generateToken();

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    const { error } = await db.from("games").insert({
      code,
      status: level ? "choosing" : "waiting",
      host_token: token,
      // El token del bot no se le da a nadie, así que la sala queda cerrada.
      guest_token: level ? generateToken() : null,
      bot_level: level,
    });

    if (!error) return NextResponse.json({ code, token });
    // 23505 = clave duplicada: el código ya existía, probamos con otro.
    if (error.code !== "23505") {
      return NextResponse.json({ error: "No se pudo crear la partida" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "No se pudo generar un código libre" }, { status: 503 });
}
