import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con service role: sólo se usa en el servidor. La tabla `games` tiene
 * RLS activo y ninguna policy, así que nadie puede leer los tableros desde el
 * navegador — todo pasa por las rutas de API.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Avisa por Realtime a los dos jugadores de que la partida ha cambiado.
 * Usamos el endpoint HTTP de broadcast en vez de abrir un WebSocket porque
 * las funciones serverless se apagan en cuanto responden.
 */
export async function broadcastGameUpdate(code: string): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        messages: [{ topic: `game:${code}`, event: "update", payload: { at: Date.now() } }],
      }),
    });
  } catch {
    // El cliente también hace polling, así que un fallo aquí no rompe la partida.
  }
}
