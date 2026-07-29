"use client";

import { useState } from "react";
import { GAMES } from "@/lib/games";

type Props = {
  onChoose: (gameId: string) => Promise<void>;
};

export default function GamePicker({ onChoose }: Props) {
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
          Elige cualquiera de los dos: empieza para ambos al instante.
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
            <span className="block text-lg font-bold">{game.name}</span>
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
