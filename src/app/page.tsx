"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createGame, saveToken } from "@/lib/client/session";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy("create");
    setError(null);
    try {
      const game = await createGame();
      saveToken(game.code, game.token);
      router.push(`/game/${game.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la partida");
      setBusy(null);
    }
  };

  const join = (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length < 4) return;
    setBusy("join");
    router.push(`/game/${code}`);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 p-6">
      <header className="text-center">
        <p className="text-6xl">🚢</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Hundir la Flota</h1>
        <p className="mt-2 text-foam/60">Dos jugadores, dos móviles, una batalla.</p>
      </header>

      {error && (
        <p className="rounded-lg bg-red-500/15 px-3 py-2 text-center text-sm text-red-200 ring-1 ring-red-500/30">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={create}
          disabled={busy !== null}
          className="rounded-2xl bg-emerald-400 px-6 py-5 text-xl font-bold text-sea-950 disabled:opacity-50 active:brightness-110"
        >
          {busy === "create" ? "Creando…" : "Crear partida"}
        </button>

        <div className="flex items-center gap-3 text-foam/40">
          <span className="h-px flex-1 bg-foam/15" />
          <span className="text-xs uppercase tracking-widest">o únete</span>
          <span className="h-px flex-1 bg-foam/15" />
        </div>

        <form onSubmit={join} className="flex flex-col gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
            placeholder="CÓDIGO"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="rounded-2xl bg-sea-900 px-6 py-5 text-center font-mono text-3xl font-bold tracking-[0.3em] uppercase ring-1 ring-sea-700 outline-none placeholder:tracking-normal placeholder:text-foam/25 focus:ring-2 focus:ring-sea-500"
          />
          <button
            type="submit"
            disabled={code.length < 4 || busy !== null}
            className="rounded-2xl bg-sea-700 px-6 py-4 text-lg font-semibold ring-1 ring-sea-500/50 disabled:opacity-40 active:brightness-110"
          >
            {busy === "join" ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-foam/40">
        Cada acierto te da otro disparo. Gana quien hunda los 5 barcos primero.
      </p>
    </main>
  );
}
