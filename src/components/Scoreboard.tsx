import type { PlayerTally } from "@/lib/server/games";

/** Marcador de la sala para un juego. Devuelve null si aún no se jugó nada. */
export default function Scoreboard({
  tally,
  compact,
}: {
  tally: PlayerTally | undefined;
  compact?: boolean;
}) {
  if (!tally) return null;
  const played = tally.you + tally.opponent + tally.draws;
  if (played === 0) return null;

  if (compact) {
    return (
      <span className="rounded-full bg-sea-950/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-foam/70">
        {tally.you}–{tally.opponent}
        {tally.draws > 0 && <span className="font-normal opacity-60"> ({tally.draws}✕)</span>}
      </span>
    );
  }

  return (
    <div className="flex items-center justify-center gap-5 rounded-xl bg-sea-800/70 px-4 py-3 ring-1 ring-sea-700">
      <span className="text-center">
        <span className="block text-2xl font-black tabular-nums">{tally.you}</span>
        <span className="block text-xs text-foam/50">tú</span>
      </span>
      <span className="text-foam/25">—</span>
      <span className="text-center">
        <span className="block text-2xl font-black tabular-nums">{tally.opponent}</span>
        <span className="block text-xs text-foam/50">rival</span>
      </span>
      {tally.draws > 0 && (
        <>
          <span className="text-foam/25">·</span>
          <span className="text-center">
            <span className="block text-2xl font-black tabular-nums text-foam/60">
              {tally.draws}
            </span>
            <span className="block text-xs text-foam/50">
              {tally.draws === 1 ? "empate" : "empates"}
            </span>
          </span>
        </>
      )}
    </div>
  );
}
