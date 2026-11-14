import { dungeonBot } from "@/lib/games/dungeon/bot";
import {
  AJAR,
  BUFF_TURNS,
  CELLS,
  CHASE,
  CHEST_GOLD,
  damage,
  defOf,
  DOOR,
  edgeOf,
  type Edges,
  flood,
  generate,
  HERO_ATK,
  HERO_HP,
  lit,
  MONSTER,
  neighbors,
  passable,
  pathTo,
  POTION_HEAL,
  setEdge,
  START,
  TEAM_GOAL,
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
import {
  defineGame,
  type MoveResult,
  other,
  type Side,
} from "@/lib/games/types";

export type { DungeonMove, DungeonState, DungeonView };

function reveal(seen: number[], edges: Edges, from: number) {
  for (const i of lit(edges, from)) seen[i] = 1;
}

/** Quedan monedas, cofre o monstruos: todavía hay botín por el que pelear. */
const hayBotin = (s: DungeonState) =>
  s.items.some((it) => it === "gold" || it === "chest") ||
  s.monsters.some(Boolean);

/**
 * Turno de los monstruos, sólo en cooperativo. El que haya quedado a la luz
 * de un héroe se despierta, y despierto persigue al más cercano y le pega si
 * lo alcanza. No abren puertas: cerrar el paso tras una es una defensa válida.
 */
function monstruosActuan(s: DungeonState, last: LastTurn) {
  const lados: Side[] = ["host", "guest"];
  const luz = new Set(lados.flatMap((l) => lit(s, s.heroes[l].pos)));
  const heroeEn = (c: number) => lados.find((l) => s.heroes[l].pos === c);
  last.bites = [];

  const turno = s.monsters.flatMap((m, i) => (m ? [i] : []));
  for (const desde of turno) {
    const m = s.monsters[desde];
    if (!m) continue;
    if (luz.has(desde)) m.awake = true;
    if (!m.awake) continue;

    const alcance = flood(
      desde,
      (a, b) => passable(edgeOf(s, a, b)) && !s.monsters[b] && !heroeEn(b),
      CHASE,
    );
    // La casilla más cercana desde la que pegar a alguien.
    let meta = -1;
    for (const l of lados) {
      for (const n of neighbors(s.heroes[l].pos)) {
        if (!(n in alcance) || !passable(edgeOf(s, n, s.heroes[l].pos)))
          continue;
        if (meta === -1 || alcance[n].d < alcance[meta].d) meta = n;
      }
    }
    if (meta === -1) continue;

    const camino = pathTo(alcance, meta).slice(0, MONSTER[m.kind].speed);
    const pos = camino.length ? camino[camino.length - 1] : desde;
    if (pos !== desde) {
      s.monsters[pos] = m;
      s.monsters[desde] = null;
    }

    // Pega a quien tenga al lado; si son los dos, al que esté peor.
    const aTiro = lados
      .filter(
        (l) =>
          neighbors(pos).includes(s.heroes[l].pos) &&
          passable(edgeOf(s, pos, s.heroes[l].pos)),
      )
      .sort((a, b) => s.heroes[a].hp - s.heroes[b].hp);
    if (aTiro.length) {
      const who = aTiro[0];
      const dmg = damage(MONSTER[m.kind].atk, defOf(s.heroes[who]));
      s.heroes[who].hp -= dmg;
      last.bites.push({ kind: m.kind, dmg, who });
      if (who === last.side) last.hurt += dmg;
    }
  }
}

const makeDungeon = (coop: boolean) =>
  defineGame<DungeonState, DungeonMove>({
    id: coop ? "dungeon_coop" : "dungeon",
    name: coop ? "Mazmorra en equipo" : "Mazmorra",
    emoji: coop ? "🛡️" : "🗝️",
    tagline: coop
      ? `Juntos contra la mazmorra: reunid ${TEAM_GOAL} de oro sin que caiga ninguno.`
      : "Duelo a oscuras: saquea más que tu rival… o acaba con él.",
    cooperative: coop,
    ...(coop
      ? { teamOutcome: (state: DungeonState) => state.result ?? null }
      : {}),

    createState(): DungeonState {
      const board = generate();
      const seen: Record<Side, number[]> = {
        host: new Array<number>(CELLS).fill(0),
        guest: new Array<number>(CELLS).fill(0),
      };
      reveal(seen.host, board, START.host);
      reveal(seen.guest, board, START.guest);
      if (coop) {
        // En equipo se comparte lo que ve cada uno desde el primer momento.
        reveal(seen.host, board, START.guest);
        reveal(seen.guest, board, START.host);
      }
      const hero = (pos: number) => ({
        pos,
        hp: HERO_HP,
        atk: HERO_ATK,
        def: 0,
        gold: 0,
        haste: 0,
        ward: 0,
      });
      return {
        ...board,
        heroes: { host: hero(START.host), guest: hero(START.guest) },
        seen,
        turnsLeft: { host: TURNS, guest: TURNS },
        last: null,
        ...(coop ? { coop: true } : {}),
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
        east: [...state.east],
        south: [...state.south],
        items: [...state.items],
        monsters: state.monsters.map((m) => (m ? { ...m } : null)),
        heroes: {
          host: { ...state.heroes.host },
          guest: { ...state.heroes.guest },
        },
        seen: { host: [...state.seen.host], guest: [...state.seen.guest] },
        turnsLeft: { ...state.turnsLeft },
      };
      const me = s.heroes[side];
      const rival = s.heroes[rivalSide];
      // Lo que alumbra uno lo ven los dos cuando van en equipo.
      const alumbrar = (from: number) => {
        reveal(s.seen[side], s, from);
        if (s.coop) reveal(s.seen[rivalSide], s, from);
      };
      const last: LastTurn = {
        side,
        at: me.pos,
        gold: 0,
        healed: 0,
        sword: false,
        shield: false,
        haste: false,
        ward: false,
        opened: false,
        bumped: false,
        ambush: null,
        hit: null,
        hurt: 0,
      };

      if (move?.type === "act") {
        const to = move.to;
        if (
          typeof to !== "number" ||
          !Number.isInteger(to) ||
          to < 0 ||
          to >= CELLS
        ) {
          return { ok: false, error: "Casilla no válida" };
        }
        const { reach, targets } = optionsFor(state, side);
        const objetivo = to in targets;
        if (!objetivo && (!(to in reach) || to === me.pos)) {
          return { ok: false, error: "No llegas hasta ahí" };
        }

        for (const paso of pathTo(reach, objetivo ? targets[to] : to)) {
          // Una puerta cerrada se abre al cruzarla, y abierta se queda.
          if (edgeOf(s, me.pos, paso) === DOOR) {
            setEdge(s, me.pos, paso, AJAR);
            last.opened = true;
            alumbrar(me.pos);
          }
          // El rival estaba a oscuras en mitad del camino: te topas con él.
          if (paso === rival.pos) {
            last.bumped = true;
            break;
          }
          // O había algo esperando justo detrás de la puerta.
          const acecha = s.monsters[paso];
          if (acecha) {
            last.ambush = acecha.kind;
            break;
          }
          me.pos = paso;
          alumbrar(paso);
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
          } else if (item === "haste") {
            last.haste = true;
          } else if (item === "ward") {
            last.ward = true;
          }
          s.items[paso] = null;
        }

        // Si un tropiezo le dejó lejos del objetivo, el golpe se pierde.
        const aTiro =
          neighbors(me.pos).includes(to) && passable(edgeOf(s, me.pos, to));
        if (objetivo && !last.bumped && !last.ambush && aTiro) {
          const monstruo = s.monsters[to];
          if (monstruo) {
            monstruo.hp -= me.atk;
            const muerto = monstruo.hp <= 0;
            if (muerto) {
              s.monsters[to] = null;
              me.gold += MONSTER[monstruo.kind].gold;
              last.gold += MONSTER[monstruo.kind].gold;
            }
            last.hit = {
              what: monstruo.kind,
              dmg: me.atk,
              killed: muerto,
              at: to,
            };
          } else if (to === rival.pos) {
            const dmg = damage(me.atk, defOf(rival));
            rival.hp -= dmg;
            last.hit = { what: "hero", dmg, killed: rival.hp <= 0, at: to };
          }
        }
      } else if (move?.type !== "wait") {
        return { ok: false, error: "Movimiento desconocido" };
      }

      // Los potenciadores gastan un turno, salvo el recién cogido: ése empieza
      // a contar en el siguiente, y el amuleto ya protege desde ahora.
      if (me.haste > 0) me.haste -= 1;
      if (me.ward > 0) me.ward -= 1;
      if (last.haste) me.haste = BUFF_TURNS;
      if (last.ward) me.ward = BUFF_TURNS;

      if (s.coop) {
        // Los monstruos actúan una vez por ronda, cuando ya han movido los
        // dos: si lo hicieran tras cada héroe pegarían el doble y no habría
        // quien aguantase.
        if (side === "guest") monstruosActuan(s, last);
      } else {
        // En duelo los monstruos no se mueven, pero muerden a quien acabe el
        // turno pegado y sin un muro o una puerta cerrada de por medio.
        for (const n of neighbors(me.pos)) {
          const m = s.monsters[n];
          if (m && passable(edgeOf(s, me.pos, n)))
            last.hurt += damage(MONSTER[m.kind].atk, defOf(me));
        }
        me.hp -= last.hurt;
      }
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

      if (s.coop) {
        // Se gana y se pierde juntos: basta que caiga uno, o quedarse sin
        // turnos antes de reunir el oro.
        const agotados = s.turnsLeft.host <= 0 && s.turnsLeft.guest <= 0;
        if (me.hp <= 0 || rival.hp <= 0) s.result = "lost";
        else if (me.gold + rival.gold >= TEAM_GOAL) s.result = "won";
        else if (agotados || !hayBotin(s)) s.result = "lost";
        if (s.result) return fin(null);
        return {
          ok: true,
          state: s,
          turn: rivalSide,
          winner: null,
          finished: false,
        };
      }

      if (rival.hp <= 0) return fin(side);
      if (me.hp <= 0) return fin(rivalSide);

      // Sin turnos o sin botín, gana quien más oro lleve encima.
      const agotado = s.turnsLeft.host <= 0 && s.turnsLeft.guest <= 0;
      if (agotado || !hayBotin(s)) {
        const diff = me.gold - rival.gold;
        return fin(diff === 0 ? null : diff > 0 ? side : rivalSide);
      }

      return {
        ok: true,
        state: s,
        turn: rivalSide,
        winner: null,
        finished: false,
      };
    },
  });

export const dungeon = makeDungeon(false);
export const dungeonCoop = makeDungeon(true);
