"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchState, getToken, joinGame } from "@/lib/client/session";
import type { PlayerView } from "@/lib/server/games";

let browserClient: SupabaseClient | null | undefined;

function supabaseBrowser(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  browserClient =
    url && key
      ? createClient(url, key, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 5 } } })
      : null;
  return browserClient;
}

const POLL_MS = 3000;

/**
 * Mantiene el estado de la partida al día: Realtime cuando está disponible y,
 * como red de seguridad, un sondeo cada pocos segundos.
 */
export function useGame(code: string) {
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const inFlight = useRef(false);
  // Mientras se reproduce la jugada del bot no se refresca: si no, el sondeo
  // adelantaría el resultado final y se perdería la animación.
  const frozen = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current || frozen.current) return;
    inFlight.current = true;
    try {
      setView(await fetchState(code));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      inFlight.current = false;
    }
  }, [code]);

  // Entrada inicial: reconectamos con el token guardado o pedimos plaza de invitado.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { view: joined } = await joinGame(code);
        if (!cancelled) setView(joined);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo entrar");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Aviso instantáneo por Realtime cada vez que el servidor toca la partida.
  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) return;

    const channel = supabase
      .channel(`game:${code}`)
      .on("broadcast", { event: "update" }, () => void refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [code, refresh]);

  // Sondeo de respaldo, en pausa mientras la pestaña está en segundo plano.
  useEffect(() => {
    if (!getToken(code)) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [code, refresh, ready]);

  const freeze = useCallback((on: boolean) => {
    frozen.current = on;
  }, []);

  return { view, setView, error, setError, ready, refresh, freeze };
}
