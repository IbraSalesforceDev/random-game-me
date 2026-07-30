"use client";

import { useState } from "react";
import Scoreboard from "@/components/Scoreboard";
import { GAMES } from "@/lib/games";
import type { PlayerTally } from "@/lib/server/games";

type Props = {
  /** Marcador de la sala por juego, para ver cómo va cada uno. */
  scores: Record<string, PlayerTally>;
  onChoose: (gameId: string) => Promise<void>;
};

export default function GamePicker({ scores, onChoose }: Props) {
  const [choosing, setChoosing] = useState<string | null>(null);

  const pick = async (id: string) => {
    setChoosing(id);
    try {
      await onChoose(id);
    } finally {
      setChoosing(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="text-xl font-bold">¿A qué jugamos?</h2>
        <p className="mt-1 text-sm text-foam/60">
          Elige el que quieras: empieza para los dos al instante.
        </p>
      </div>

      {GAMES.map((game) => (
        <button
          key={game.id}
          type="button"
          onClick={() => pick(game.id)}
          disabled={choosing !== null}
          className="flex items-center gap-4 rounded-2xl bg-sea-800 px-5 py-5 text-left ring-1 ring-sea-700 transition-colors disabled:opacity-50 active:brightness-110"
        >
          <span className="text-4xl">{game.emoji}</span>
          <span className="flex-1">
            <span className="flex items-center gap-2">
              <span className="text-lg font-bold">{game.name}</span>
              <Scoreboard tally={scores[game.id]} compact />
            </span>
            <span className="block text-sm text-foam/60">{game.tagline}</span>
          </span>
          {choosing === game.id && (
            <span className="size-5 animate-spin rounded-full border-2 border-foam/40 border-t-transparent" />
          )}
        </button>
      ))}
    </div>
  );
}
