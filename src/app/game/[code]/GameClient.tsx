"use client";

import Link from "next/link";
import { useState } from "react";
import Placement from "@/components/Placement";
import Play from "@/components/Play";
import type { Ship } from "@/lib/battleship";
import { fire, requestRematch, submitShips } from "@/lib/client/session";
import { useGame } from "@/lib/client/useGame";

function ShareCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    const text = `¡Juega a hundir la flota conmigo! Código: ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Hundir la Flota", text, url });
        return;
      } catch {
        // El usuario canceló el diálogo: caemos al portapapeles.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-foam/70">Pásale este código a tu rival:</p>
      <p className="rounded-2xl bg-sea-800 px-8 py-4 font-mono text-5xl font-bold tracking-[0.2em] ring-1 ring-sea-500/50">
        {code}
      </p>
      <button
        type="button"
        onClick={share}
        className="rounded-xl bg-sea-700 px-6 py-3 font-semibold ring-1 ring-sea-500/50 active:brightness-110"
      >
        {copied ? "¡Enlace copiado!" : "Compartir enlace"}
      </button>
    </div>
  );
}

function Waiting({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="size-8 animate-spin rounded-full border-2 border-sea-500 border-t-transparent" />
      <p className="text-foam/70">{message}</p>
    </div>
  );
}

export default function GameClient({ code }: { code: string }) {
  const { view, setView, error, setError, ready, refresh } = useGame(code);
  const [notice, setNotice] = useState<string | null>(null);

  const guard = async (action: () => Promise<void>) => {
    try {
      await action();
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Algo ha fallado");
      // El servidor manda: recargamos el estado real tras un rechazo.
      void refresh();
    }
  };

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="text-2xl font-bold">Vaya…</h1>
        <p className="text-foam/70">{error}</p>
        <Link
          href="/"
          className="rounded-xl bg-sea-700 px-6 py-3 font-semibold ring-1 ring-sea-500/50"
          onClick={() => setError(null)}
        >
          Volver al inicio
        </Link>
      </main>
    );
  }

  if (!ready || !view) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
        <Waiting message="Entrando en la partida…" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-foam/50">
          ← Salir
        </Link>
        <span className="font-mono text-sm tracking-widest text-foam/50">SALA {view.code}</span>
      </header>

      {notice && (
        <p className="rounded-lg bg-amber-400/15 px-3 py-2 text-center text-sm text-amber-200 ring-1 ring-amber-400/30">
          {notice}
        </p>
      )}

      {view.status === "waiting" && <ShareCode code={view.code} />}

      {view.status === "placing" &&
        (view.yourFleetReady ? (
          <Waiting message="Flota lista. Esperando a que el rival coloque la suya…" />
        ) : (
          <Placement
            onConfirm={(ships: Ship[]) =>
              guard(async () => setView(await submitShips(code, ships)))
            }
          />
        ))}

      {view.status === "playing" && (
        <Play
          view={view}
          onFire={(x, y) =>
            guard(async () => {
              const { view: next } = await fire(code, x, y);
              setView(next);
            })
          }
        />
      )}

      {view.status === "finished" && (
        <div className="flex flex-col gap-5">
          <div
            className={[
              "rounded-2xl px-6 py-8 text-center",
              view.winner === "you" ? "bg-emerald-400 text-sea-950" : "bg-sunk text-foam",
            ].join(" ")}
          >
            <p className="text-5xl">{view.winner === "you" ? "🏆" : "💥"}</p>
            <h1 className="mt-2 text-3xl font-black">
              {view.winner === "you" ? "¡Has ganado!" : "Has perdido"}
            </h1>
            <p className="mt-1 opacity-80">
              {view.winner === "you"
                ? "Has hundido toda su flota."
                : "Tu flota ha sido hundida."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => guard(async () => setView(await requestRematch(code)))}
            className="rounded-xl bg-emerald-400 px-4 py-4 text-lg font-bold text-sea-950 active:brightness-110"
          >
            Revancha
          </button>
          <Link
            href="/"
            className="rounded-xl bg-sea-800 px-4 py-3 text-center font-semibold ring-1 ring-sea-700"
          >
            Volver al inicio
          </Link>
        </div>
      )}
    </main>
  );
}
