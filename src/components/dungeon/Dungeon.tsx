"use client";

import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import {
  GiBroadsword,
  GiCheckedShield,
  GiGoblinHead,
  GiHealthPotion,
  GiHearts,
  GiHoodedAssassin,
  GiLockedChest,
  GiOrcHead,
  GiRat,
  GiSkeleton,
  GiTwoCoins,
  GiVisoredHelm,
} from "react-icons/gi";
import Thinking from "@/components/Thinking";
import type { DungeonView } from "@/lib/games/dungeon/module";
import { type Item, MONSTER, type MonsterKind, W } from "@/lib/games/dungeon/rules";
import type { LastTurn, ViewCell } from "@/lib/games/dungeon/state";
import type { PlayerView } from "@/lib/server/games";

type Props = {
  view: PlayerView;
  game: DungeonView;
  onAct: (to: number) => Promise<void>;
  onWait: () => Promise<void>;
  thinking: boolean;
};

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

/**
 * Iconos de game-icons.net (CC BY 3.0), de aire tablero de mazmorras. Cada
 * cosa lleva su color para distinguirla de un vistazo en casillas pequeñas.
 */
type Glyph = { Icon: IconType; color: string };
const ITEM: Record<Item, Glyph> = {
  gold: { Icon: GiTwoCoins, color: "text-yellow-400" },
  chest: { Icon: GiLockedChest, color: "text-amber-400" },
  potion: { Icon: GiHealthPotion, color: "text-pink-400" },
  sword: { Icon: GiBroadsword, color: "text-sky-300" },
  shield: { Icon: GiCheckedShield, color: "text-indigo-300" },
};
const BEAST: Record<MonsterKind, Glyph> = {
  rat: { Icon: GiRat, color: "text-amber-600" },
  goblin: { Icon: GiGoblinHead, color: "text-lime-400" },
  skeleton: { Icon: GiSkeleton, color: "text-slate-200" },
  orc: { Icon: GiOrcHead, color: "text-orange-400" },
};
const YOU: Glyph = { Icon: GiVisoredHelm, color: "text-emerald-300" };
const RIVAL: Glyph = { Icon: GiHoodedAssassin, color: "text-rose-400" };

/** Cuenta en una frase lo último que pasó, desde el punto de vista de quien mira. */
function relato(last: LastTurn, mine: boolean): string {
  if (!mine) {
    if (last.hit?.what === "hero") return `⚔️ El rival te ataca: −${last.hit.dmg} de vida`;
    return "👀 Ves moverse al rival";
  }
  const partes: string[] = [];
  if (last.bumped) partes.push("te topas con el rival a oscuras");
  if (last.hit) {
    const quien = last.hit.what === "hero" ? "el rival" : MONSTER[last.hit.what].name;
    partes.push(
      last.hit.killed
        ? `acabas con ${quien}`
        : `golpeas a ${quien} (−${last.hit.dmg})`.replace("a el ", "al "),
    );
  }
  if (last.gold) partes.push(`+${last.gold} de oro`);
  if (last.healed) partes.push(`+${last.healed} de vida`);
  if (last.sword) partes.push("espada: +1 de ataque");
  if (last.shield) partes.push("escudo: +1 de defensa");
  if (last.hurt) partes.push(`te muerden: −${last.hurt} de vida`);
  if (partes.length === 0) return "";
  const frase = partes.join(" · ");
  return frase[0].toUpperCase() + frase.slice(1);
}

function Stats({
  title,
  hp,
  atk,
  def,
  gold,
}: {
  title: string;
  hp: number;
  atk: number;
  def: number;
  gold: number;
}) {
  const dato = "flex items-center gap-1";
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-xl bg-sea-800/70 px-2.5 py-2 ring-1 ring-sea-700">
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-foam/50">{title}</span>
      <span className="flex items-center justify-between text-sm font-bold tabular-nums">
        <span className={`${dato} ${hp <= 4 ? "text-hit" : ""}`}>
          <GiHearts className="text-hit" /> {Math.max(0, hp)}
        </span>
        <span className={dato}>
          <GiBroadsword className="text-sky-300" /> {atk}
        </span>
        <span className={dato}>
          <GiCheckedShield className="text-indigo-300" /> {def}
        </span>
        <span className={dato}>
          <GiTwoCoins className="text-yellow-400" /> {gold}
        </span>
      </span>
    </div>
  );
}

export default function Dungeon({ view, game, onAct, onWait, thinking }: Props) {
  const [sending, setSending] = useState(false);
  const playable = view.yourTurn && view.status === "playing" && !sending;
  const rival = view.you === "host" ? "guest" : "host";

  const hadTurn = useRef(view.yourTurn);
  useEffect(() => {
    if (view.yourTurn && !hadTurn.current) buzz(45);
    hadTurn.current = view.yourTurn;
  }, [view.yourTurn]);

  // Un golpe recibido se nota en la mano aunque estés mirando otra cosa.
  const hpRef = useRef(game.you.hp);
  useEffect(() => {
    if (game.you.hp < hpRef.current) buzz([70, 50, 70]);
    hpRef.current = game.you.hp;
  }, [game.you.hp]);

  const send = async (fn: () => Promise<void>) => {
    setSending(true);
    try {
      await fn();
    } finally {
      setSending(false);
    }
  };

  // Cada uno ve su esquina abajo a la izquierda: el invitado mira el mapa girado.
  const orden = game.cells.map((_, i) => i);
  if (view.you === "guest") orden.reverse();

  const last = game.last;
  const texto = last ? relato(last, last.side === view.you) : "";
  const malo = Boolean(last && (last.side !== view.you ? last.hit?.what === "hero" : last.hurt > 0));

  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-center font-bold transition-colors",
          view.yourTurn ? "bg-emerald-400 text-sea-950" : "bg-sea-800 text-foam/70",
        ].join(" ")}
      >
        {view.yourTurn ? (
          `Tu turno · te quedan ${game.turnsLeft}`
        ) : (
          <>
            Turno del rival
            <Thinking active={thinking} />
          </>
        )}
      </div>

      <div className="flex gap-2">
        <Stats title="Tú" {...game.you} />
        <Stats title="Rival" {...game.rival} />
      </div>

      {texto && (
        <p
          key={`${last?.side}-${game.turnsLeft}-${game.you.hp}-${game.you.gold}`}
          className={[
            "rounded-lg px-3 py-2 text-center text-sm",
            malo
              ? "animate-alert-hit bg-hit/85 text-white"
              : "animate-alert bg-water/[0.18] text-foam ring-1 ring-water/70",
          ].join(" ")}
        >
          {texto}
        </p>
      )}

      <div
        className="grid gap-[2px] rounded-xl bg-sea-950 p-1 ring-1 ring-sea-700/60 select-none"
        style={{ gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))` }}
      >
        {orden.map((i) => {
          const cell: ViewCell = game.cells[i];
          const alcance = playable && i in game.reach && i !== game.you.pos;
          const blanco = playable && i in game.targets;
          const dibujo: Glyph | null = cell.hero
            ? cell.hero === view.you
              ? YOU
              : RIVAL
            : cell.monster
              ? BEAST[cell.monster.kind]
              : cell.item
                ? ITEM[cell.item]
                : null;

          return (
            <button
              key={i}
              type="button"
              disabled={!alcance && !blanco}
              onClick={() => send(() => onAct(i))}
              aria-label={`Casilla ${i}${cell.hero === view.you ? " tú" : ""}${cell.hero === rival ? " rival" : ""}`}
              data-k={cell.k}
              className={[
                "relative grid aspect-square place-items-center rounded-[3px] transition-colors",
                // Una sola clase de fondo, que en Tailwind dos se pisan.
                cell.k === "unknown"
                  ? "bg-sea-950"
                  : cell.k === "wall"
                    ? "bg-slate-600/80"
                    : cell.lit
                      ? "bg-sea-700/80"
                      : "bg-sea-900",
                // Y un solo anillo: el blanco manda sobre el alcance.
                blanco ? "ring-2 ring-inset ring-hit" : alcance ? "ring-1 ring-inset ring-emerald-300/60" : "",
              ].join(" ")}
            >
              {dibujo && (
                <dibujo.Icon
                  className={[
                    "size-[78%]",
                    dibujo.color,
                    cell.k === "floor" && !cell.lit ? "opacity-45" : "",
                  ].join(" ")}
                />
              )}
              {cell.monster && (
                <span className="absolute right-0 bottom-0 rounded-tl bg-sea-950/80 px-[2px] text-[0.5rem] leading-tight font-bold text-foam tabular-nums">
                  {cell.monster.hp}
                </span>
              )}
              {last && last.at === i && cell.hero && (
                <span className="animate-last-move pointer-events-none absolute inset-0 rounded-[3px] border-2 border-foam" />
              )}
            </button>
          );
        })}
      </div>

      {playable && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-foam/45">
            Toca una casilla con borde verde para ir, o un enemigo con borde rojo para cargar.
          </p>
          <button
            type="button"
            onClick={() => send(onWait)}
            className="shrink-0 rounded-lg bg-sea-800 px-3 py-2 text-sm font-semibold ring-1 ring-sea-700 active:brightness-110"
          >
            Esperar
          </button>
        </div>
      )}

      {/* Bestiario: con cuatro monstruos ya no se recuerdan de memoria. */}
      <div className="grid grid-cols-4 gap-1.5 text-[0.7rem] text-foam/60">
        {(Object.keys(BEAST) as MonsterKind[]).map((kind) => {
          const { Icon, color } = BEAST[kind];
          return (
            <span
              key={kind}
              className="flex items-center justify-center gap-1 rounded-lg bg-sea-900/60 px-1 py-1.5 tabular-nums"
            >
              <Icon className={`size-5 ${color}`} />
              <GiHearts className="text-hit/80" />
              {MONSTER[kind].hp}
              <GiBroadsword className="text-sky-300/80" />
              {MONSTER[kind].atk}
            </span>
          );
        })}
      </div>

      <p className="text-center text-[0.7rem] leading-relaxed text-foam/40">
        Los monstruos golpean si acabas el turno a su lado; el escudo resta uno a cada golpe. Gana
        quien más oro tenga… o quien quede en pie.
        <span className="mt-1 block text-foam/25">Iconos: game-icons.net (CC BY 3.0)</span>
      </p>
    </div>
  );
}
