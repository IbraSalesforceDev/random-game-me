import { dungeonBot } from "@/lib/games/dungeon/bot";
import {
  CELLS,
  CHEST_GOLD,
  damage,
  generate,
  HERO_ATK,
  HERO_HP,
  lit,
  MONSTER,
  neighbors,
  pathTo,
  POTION_HEAL,
  START,
  TURNS,
} from "@/lib/games/dungeon/rules";
import {
  type DungeonMove,
  type DungeonState,
  type DungeonView,
  type LastTurn,
  optionsFor,
  viewFor,
} from "@/lib/games/dungeon/state";
import { defineGame, type MoveResult, other, type Side } from "@/lib/games/types";

export type { DungeonMove, DungeonState, DungeonView };

function reveal(seen: number[], from: number) {
  for (const i of lit(from)) seen[i] = 1;
}

/** Quedan monedas, cofre o monstruos: todavía hay botín por el que pelear. */
const hayBotin = (s: DungeonState) =>
  s.items.some((it) => it === "gold" || it === "chest") || s.monsters.some(Boolean);

export const dungeon = defineGame<DungeonState, DungeonMove>({
  id: "dungeon",
  name: "Mazmorra",
  emoji: "🗝️",
  tagline: "Duelo a oscuras: saquea más que tu rival… o acaba con él.",

  createState(): DungeonState {
    const board = generate();
    const seen: Record<Side, number[]> = {
      host: new Array<number>(CELLS).fill(0),
      guest: new Array<number>(CELLS).fill(0),
    };
    reveal(seen.host, START.host);
    reveal(seen.guest, START.guest);
    const hero = (pos: number) => ({ pos, hp: HERO_HP, atk: HERO_ATK, def: 0, gold: 0 });
    return {
      ...board,
      heroes: { host: hero(START.host), guest: hero(START.guest) },
      seen,
      turnsLeft: { host: TURNS, guest: TURNS },
      last: null,
    };
  },

  initialTurn: () => "host",

  toView: viewFor,

  bot: dungeonBot,

  applyMove(state, side, move): MoveResult<DungeonState> {
    const rivalSide = other(side);
    // Copia de trabajo: el estado que llega no se toca.
    const s: DungeonState = {
      ...state,
      items: [...state.items],
      monsters: state.monsters.map((m) => (m ? { ...m } : null)),
      heroes: { host: { ...state.heroes.host }, guest: { ...state.heroes.guest } },
      seen: { host: [...state.seen.host], guest: [...state.seen.guest] },
      turnsLeft: { ...state.turnsLeft },
    };
    const me = s.heroes[side];
    const rival = s.heroes[rivalSide];
    const last: LastTurn = {
      side,
      at: me.pos,
      gold: 0,
      healed: 0,
      sword: false,
      shield: false,
      bumped: false,
      hit: null,
      hurt: 0,
    };

    if (move?.type === "act") {
      const to = move.to;
      if (typeof to !== "number" || !Number.isInteger(to) || to < 0 || to >= CELLS) {
        return { ok: false, error: "Casilla no válida" };
      }
      const { reach, targets } = optionsFor(state, side);
      const objetivo = to in targets;
      if (!objetivo && (!(to in reach) || to === me.pos)) {
        return { ok: false, error: "No llegas hasta ahí" };
      }

      for (const paso of pathTo(reach, objetivo ? targets[to] : to)) {
        // El rival estaba a oscuras en mitad del camino: te topas con él.
        if (paso === rival.pos) {
          last.bumped = true;
          break;
        }
        me.pos = paso;
        reveal(s.seen[side], paso);
        const item = s.items[paso];
        if (item === "gold") {
          me.gold += 1;
          last.gold += 1;
        } else if (item === "chest") {
          me.gold += CHEST_GOLD;
          last.gold += CHEST_GOLD;
        } else if (item === "potion") {
          const cura = Math.min(POTION_HEAL, HERO_HP - me.hp);
          me.hp += cura;
          last.healed += cura;
        } else if (item === "sword") {
          me.atk += 1;
          last.sword = true;
        } else if (item === "shield") {
          me.def += 1;
          last.shield = true;
        }
        s.items[paso] = null;
      }

      // Si un tropiezo le dejó lejos del objetivo, el golpe se pierde.
      if (objetivo && !last.bumped && neighbors(me.pos).includes(to)) {
        const monstruo = s.monsters[to];
        if (monstruo) {
          monstruo.hp -= me.atk;
          const muerto = monstruo.hp <= 0;
          if (muerto) {
            s.monsters[to] = null;
            me.gold += MONSTER[monstruo.kind].gold;
            last.gold += MONSTER[monstruo.kind].gold;
          }
          last.hit = { what: monstruo.kind, dmg: me.atk, killed: muerto, at: to };
        } else if (to === rival.pos) {
          const dmg = damage(me.atk, rival.def);
          rival.hp -= dmg;
          last.hit = { what: "hero", dmg, killed: rival.hp <= 0, at: to };
        }
      }
    } else if (move?.type !== "wait") {
      return { ok: false, error: "Movimiento desconocido" };
    }

    // Los monstruos no se mueven, pero muerden a quien acabe el turno pegado.
    for (const n of neighbors(me.pos)) {
      const m = s.monsters[n];
      if (m) last.hurt += damage(MONSTER[m.kind].atk, me.def);
    }
    me.hp -= last.hurt;
    last.at = me.pos;
    s.last = last;
    s.turnsLeft[side] -= 1;

    const fin = (winner: Side | null): MoveResult<DungeonState> => ({
      ok: true,
      state: s,
      turn: null,
      winner,
      finished: true,
    });

    if (rival.hp <= 0) return fin(side);
    if (me.hp <= 0) return fin(rivalSide);

    // Sin turnos o sin botín, gana quien más oro lleve encima.
    const agotado = s.turnsLeft.host <= 0 && s.turnsLeft.guest <= 0;
    if (agotado || !hayBotin(s)) {
      const diff = me.gold - rival.gold;
      return fin(diff === 0 ? null : diff > 0 ? side : rivalSide);
    }

    return { ok: true, state: s, turn: rivalSide, winner: null, finished: false };
  },
});
