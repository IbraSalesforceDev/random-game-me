import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/**
 * Mantiene despierta la base de datos. El plan gratuito de Supabase pausa el
 * proyecto tras unos días sin actividad, y con la base dormida no se puede ni
 * crear una sala. Un cron de Vercel (ver `vercel.json`) llama aquí cada tres
 * días; la consulta es lo más barato que cuenta como actividad.
 *
 * Es pública a propósito: no devuelve nada de las partidas, sólo si la base
 * ha contestado.
 */
export async function GET() {
  const { error } = await supabaseAdmin()
    .from("games")
    .select("code", { count: "exact", head: true });

  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true });
}
