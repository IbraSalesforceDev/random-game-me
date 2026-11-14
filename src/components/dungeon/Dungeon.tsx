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
  GiMagicShield,
  GiOrcHead,
  GiRat,
  GiSkeleton,
  GiTwoCoins,
  GiVisoredHelm,
  GiWingfoot,
  GiWoodenDoor,
} from "react-icons/gi";
import Thinking from "@/components/Thinking";
import type { DungeonView } from "@/lib/games/dungeon/module";
import {
  AJAR,
  defOf,
  DOOR,
  H,
  HASTE_STEPS,
  type Hero,
  type Item,
  MONSTER,
  type MonsterKind,
  W,
  WALL,
  WARD_DEF,
} from "@/lib/games/dungeon/rules";
import type { LastTurn } from "@/lib/games/dungeon/state";
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
  haste: { Icon: GiWingfoot, color: "text-cyan-300" },
  ward: { Icon: GiMagicShield, color: "text-violet-300" },
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
    if (last.hit?.what === "hero") return `El rival te ataca: −${last.hit.dmg} de vida`;
    return last.opened ? "Oyes abrirse una puerta: el rival anda cerca" : "Ves moverse al rival";
  }
  const partes: string[] = [];
  if (last.ambush) partes.push(`abres la puerta y te espera ${MONSTER[last.ambush].name}`);
  else if (last.opened) partes.push("abres una puerta");
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
  if (last.haste) partes.push(`botas: +${HASTE_STEPS} pasos durante 3 turnos`);
  if (last.ward) partes.push(`amuleto: +${WARD_DEF} de defensa durante 3 turnos`);
  if (last.hurt) partes.push(`te muerden: −${last.hurt} de vida`);
  if (partes.length === 0) return "";
  const frase = partes.join(" · ");
  return frase[0].toUpperCase() + frase.slice(1);
}

function Stats({ title, hero }: { title: string; hero: Omit<Hero, "pos"> }) {
  const dato = "flex items-center gap-1";
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-xl bg-sea-800/70 px-2.5 py-2 ring-1 ring-sea-700">
      <span className="flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-wide text-foam/50">
        {title}
        {/* Potenciadores activos, con los turnos que les quedan. */}
        <span className="flex gap-1.5 normal-case tabular-nums">
          {hero.haste > 0 && (
            <span className="flex items-center gap-0.5 text-cyan-300">
              <GiWingfoot /> {hero.haste}
            </span>
          )}
          {hero.ward > 0 && (
            <span className="flex items-center gap-0.5 text-violet-300">
              <GiMagicShield /> {hero.ward}
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center justify-between text-sm font-bold tabular-nums">
        <span className={`${dato} ${hero.hp <= 4 ? "text-hit" : ""}`}>
          <GiHearts className="text-hit" /> {Math.max(0, hero.hp)}
        </span>
        <span className={dato}>
          <GiBroadsword className="text-sky-300" /> {hero.atk}
        </span>
        <span className={`${dato} ${hero.ward > 0 ? "text-violet-300" : ""}`}>
          <GiCheckedShield className="text-indigo-300" /> {defOf(hero)}
        </span>
        <span className={dato}>
          <GiTwoCoins className="text-yellow-400" /> {hero.gold}
        </span>
      </span>
    </div>
  );
}

/** Colores de un borde: muro de piedra, puerta de madera, puerta ya abierta. */
const BORDE: Record<number, string> = {
  [WALL]: "bg-stone-300",
  [DOOR]: "bg-amber-500",
  [AJAR]: "bg-amber-900/70",
};

export default function Dungeon({ view, game, onAct, onWait, thinking }: Props) {
  const [sending, setSending] = useState(false);
  const playable = view.yourTurn && view.status === "playing" && !sending;
  const girado = view.you === "guest";

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
  if (girado) orden.reverse();

  /** Dónde cae una casilla en pantalla, en porcentaje del tablero. */
  const lugar = (i: number) => {
    const x = girado ? W - 1 - (i % W) : i % W;
    const y = girado ? H - 1 - Math.floor(i / W) : Math.floor(i / W);
    return { left: `${(x * 100) / W}%`, top: `${(y * 100) / H}%` };
  };
  const tam = { width: `${100 / W}%`, height: `${100 / H}%` };

  const last = game.last;
  const texto = last ? relato(last, last.side === view.you) : "";
  const malo = Boolean(
    last && (last.side !== view.you ? last.hit?.what === "hero" : last.hurt > 0),
  );

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
        <Stats title="Tú" hero={game.you} />
        <Stats title="Rival" hero={game.rival} />
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

      {/* El tablero se sale un poco de los márgenes de la página: con quince
          casillas de ancho, cada píxel cuenta para que se puedan tocar. */}
      <div className="relative -mx-2.5 overflow-hidden rounded-lg border-[3px] border-stone-400 bg-stone-950 select-none">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))` }}>
          {orden.map((i) => {
            const cell = game.cells[i];
            const paso = playable && i in game.reach && i !== game.you.pos;
            const blanco = playable && i in game.targets;
            // Una casilla sin ver a la que sí se llega es lo de detrás de una puerta.
            const umbral = paso && !cell.known;
            const dibujo: Glyph | null = cell.monster
              ? BEAST[cell.monster.kind]
              : cell.item
                ? ITEM[cell.item]
                : null;

            // Cada casilla pinta su borde derecho y el de abajo. Con el mapa
            // girado, esos mismos bordes caen a la izquierda y arriba.
            const este = i % W < W - 1 ? game.east[i] : 0;
            const sur = i + W < game.cells.length ? game.south[i] : 0;

            return (
              <button
                key={i}
                type="button"
                disabled={!paso && !blanco}
                onClick={() => send(() => onAct(i))}
                aria-label={`Casilla ${i}`}
                data-k={cell.known ? "floor" : "unknown"}
                className={[
                  "relative grid aspect-square place-items-center transition-colors duration-300",
                  // Una sola clase de fondo, que en Tailwind dos se pisan.
                  !cell.known ? "bg-stone-950" : cell.lit ? "bg-slate-600" : "bg-slate-800",
                  // Juntas de baldosa, sólo en lo que se conoce.
                  cell.known ? "shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.45)]" : "",
                ].join(" ")}
              >
                {dibujo && (
                  <dibujo.Icon
                    className={["size-[80%]", dibujo.color, cell.lit ? "" : "opacity-45"].join(" ")}
                  />
                )}
                {cell.monster && (
                  <span className="absolute right-0 bottom-0 rounded-tl bg-stone-950/85 px-[2px] text-[0.5rem] leading-tight font-bold text-foam tabular-nums">
                    {cell.monster.hp}
                  </span>
                )}
                {umbral && <GiWoodenDoor className="size-[70%] text-amber-400" />}
                {/* Un solo marcador: el blanco manda sobre el paso. */}
                {(blanco || paso) && (
                  <span
                    className={[
                      "pointer-events-none absolute inset-[1px] rounded-[2px] border",
                      blanco
                        ? "border-2 border-hit"
                        : umbral
                          ? "border-amber-400/80"
                          : "border-emerald-300/55",
                    ].join(" ")}
                  />
                )}
                {este > 0 && (
                  <span
                    data-edge={este}
                    className={[
                      "pointer-events-none absolute top-0 z-10 w-[3px]",
                      girado ? "-left-[1.5px]" : "-right-[1.5px]",
                      // Una puerta abierta deja sólo el quicio. Una única clase
                      // de alto: dos se pisarían según el orden del CSS.
                      este === AJAR ? "h-1/4" : "h-full",
                      BORDE[este],
                    ].join(" ")}
                  />
                )}
                {sur > 0 && (
                  <span
                    data-edge={sur}
                    className={[
                      "pointer-events-none absolute left-0 z-10 h-[3px]",
                      girado ? "-top-[1.5px]" : "-bottom-[1.5px]",
                      sur === AJAR ? "w-1/4" : "w-full",
                      BORDE[sur],
                    ].join(" ")}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Los héroes van en una capa aparte para que se deslicen de una
            casilla a otra en vez de saltar. La luz de tu antorcha va con el tuyo. */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute transition-all duration-500 ease-out"
            style={{ ...lugar(game.you.pos), ...tam }}
          >
            <div className="absolute top-1/2 left-1/2 size-[700%] -translate-1/2 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.16)_0%,rgba(251,191,36,0.06)_40%,transparent_68%)]" />
            <YOU.Icon
              aria-label="tú"
              className={`relative size-full p-[8%] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${YOU.color}`}
            />
            {last?.side === view.you && (
              <span
                key={game.turnsLeft}
                className="animate-last-move absolute inset-0 rounded-[2px] border-2 border-foam"
              />
            )}
          </div>
          {game.rival.pos !== null && (
            <div
              className="absolute transition-all duration-500 ease-out"
              style={{ ...lugar(game.rival.pos), ...tam }}
            >
              <RIVAL.Icon
                aria-label="rival"
                className={`size-full p-[8%] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${RIVAL.color}`}
              />
              {last && last.side !== view.you && (
                <span
                  key={`r-${game.turnsLeft}-${game.rival.pos}`}
                  className="animate-last-move absolute inset-0 rounded-[2px] border-2 border-foam"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {playable && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-foam/45">
            Verde: ir. <span className="text-amber-400/90">Ámbar: abrir una puerta.</span>{" "}
            <span className="text-hit/90">Rojo: cargar.</span>
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
        <GiWingfoot className="inline text-cyan-300" /> botas: +{HASTE_STEPS} pasos ·{" "}
        <GiMagicShield className="inline text-violet-300" /> amuleto: +{WARD_DEF} defensa (3 turnos
        cada uno). Los monstruos golpean si acabas el turno a su lado sin un muro por medio. Gana
        quien más oro tenga… o quien quede en pie.
        <span className="mt-1 block text-foam/25">Iconos: game-icons.net (CC BY 3.0)</span>
      </p>
    </div>
  );
}
