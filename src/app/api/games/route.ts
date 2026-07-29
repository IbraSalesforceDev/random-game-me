import { NextResponse } from "next/server";
import { generateCode, generateToken } from "@/lib/server/games";
import { supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/** Crea una partida nueva y devuelve el código de sala y el token del anfitrión. */
export async function POST() {
  const db = supabaseAdmin();
  const token = generateToken();

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    const { error } = await db.from("games").insert({
      code,
      status: "waiting",
      host_token: token,
    });

    if (!error) return NextResponse.json({ code, token });
    // 23505 = clave duplicada: el código ya existía, probamos con otro.
    if (error.code !== "23505") {
      return NextResponse.json({ error: "No se pudo crear la partida" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "No se pudo generar un código libre" }, { status: 503 });
}
