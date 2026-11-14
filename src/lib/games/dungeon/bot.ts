import {
  CELLS,
  CHEST_GOLD,
  damage,
  defOf,
  edgeOf,
  HERO_HP,
  manhattan,
  MONSTER,
  neighbors,
  passable,
  pathTo,
  POTION_HEAL,
  REACH,
  WALL,
  WARD_DEF,
} from "@/lib/games/dungeon/rules";
import {
  type DungeonMove,
  type DungeonState,
  type DungeonView,
  viewFor,
} from "@/lib/games/dungeon/state";
import type { BotLevel, Side } from "@/lib/games/types";

const RUIDO: Record<BotLevel, number> = { easy: 30, medium: 7, hard: 0.01 };

/**
 * El bot de la mazmorra. Trabaja sobre `viewFor`, la misma vista que recibe
 * una persona: sólo conoce las casillas que ha alumbrado, no sabe qué hay tras
 * una puerta cerrada ni dónde anda el rival si no lo tiene delante.
 *
 * Valora cada cosa que puede hacer este turno —ir a una casilla, abrir una
 * puerta, cargar contra un enemigo— por lo que gana, lo que le cuesta en vida
 * y lo cerca que le deja de lo siguiente que merece la pena.
 */
export function dungeonBot(state: DungeonState, side: Side, level: BotLevel): DungeonMove | null {
  const view = viewFor(state, side);
  const me = view.you;

  const destinos = Object.keys(view.reach)
    .map(Number)
    .filter((c) => c !== me.pos);
  const objetivos = Object.keys(view.targets).map(Number);
  const opciones: DungeonMove[] = [...destinos, ...objetivos].map((to) => ({ type: "act", to }));
  if (opciones.length === 0) return { type: "wait" };

  const experto = level === "hard";
  const lejos = distanciaAMetas(view, experto);

  let mejor: DungeonMove = { type: "wait" };
  // Quedarse quieto casi nunca compensa, pero es mejor que suicidarse.
  let mejorNota = -5;
  for (const op of opciones) {
    if (op.type !== "act") continue;
    // El ruido es lo que separa los niveles: el fácil se despista mucho —pero
    // no pasea al azar, que eso no parece un rival—, el normal algo, y el
    // difícil sólo lo justo para no elegir siempre la primera de dos iguales.
    const ruido = Math.random() * RUIDO[level];
    const nota = valorar(view, op.to, lejos, experto) + ruido;
    if (nota > mejorNota) {
      mejorNota = nota;
      mejor = op;
    }
  }
  return mejor;
}

/** Monstruos que morderían a quien acabase en esa casilla, salvo el que se indique. */
function mordiscos(view: DungeonView, at: number, def: number, salvo = -1): number {
  let total = 0;
  for (const n of neighbors(at)) {
    const m = view.cells[n].monster;
    if (m && n !== salvo && passable(edgeOf(view, at, n))) total += damage(MONSTER[m.kind].atk, def);
  }
  return total;
}

/**
 * Pasos desde cada casilla conocida hasta lo más cercano que merece la pena:
 * botín a la vista, un monstruo asequible, una puerta por abrir o el borde de
 * lo inexplorado.
 */
function distanciaAMetas(view: DungeonView, experto: boolean): number[] {
  const { cells, you } = view;
  const def = defOf(you);
  const metas: number[] = [];
  cells.forEach((c, i) => {
    if (!c.known || c.monster) return;
    if (c.item && (c.item !== "potion" || you.hp <= HERO_HP - 3)) metas.push(i);
    for (const n of neighbors(i)) {
      const borde = edgeOf(view, i, n);
      // Terreno por alumbrar, o una puerta cerrada: detrás está lo bueno.
      if (!cells[n].known && borde !== WALL) metas.push(i);
      // Un monstruo es botín con dientes: sólo se busca con vida de sobra.
      const m = cells[n].monster;
      if (m && passable(borde) && you.hp > damage(MONSTER[m.kind].atk, def) * 2 + (experto ? 2 : 0)) {
        metas.push(i);
      }
    }
  });

  const dist = new Array<number>(CELLS).fill(Infinity);
  const cola = [...metas];
  for (const m of metas) dist[m] = 0;
  for (let q = 0; q < cola.length; q++) {
    const cur = cola[q];
    for (const n of neighbors(cur)) {
      if (dist[n] !== Infinity || !cells[n].known || cells[n].monster) continue;
      if (edgeOf(view, cur, n) === WALL) continue;
      dist[n] = dist[cur] + 1;
      cola.push(n);
    }
  }
  return dist;
}

function valorar(view: DungeonView, to: number, lejos: number[], experto: boolean): number {
  const { cells, you, rival } = view;
  const ataque = to in view.targets;
  const camino = pathTo(view.reach, ataque ? view.targets[to] : to);

  let nota = 0;
  let hp = you.hp;
  let atk = you.atk;
  let def = defOf(you);
  let fin = you.pos;

  // Lo que recoge por el camino.
  const nuevas = new Set<number>();
  for (const paso of camino) {
    if (!cells[paso].known) {
      // Cruzar una puerta a ciegas: suele haber botín, y a veces dientes. Si
      // hay algo detrás se queda en el umbral, así que se cuenta desde ahí.
      nota += 9;
      if (hp <= 4) nota -= experto ? 14 : 6;
      break;
    }
    fin = paso;
    const item = cells[paso].item;
    if (item === "gold") nota += 10;
    else if (item === "chest") nota += CHEST_GOLD * 10;
    else if (item === "sword") {
      nota += 14;
      atk += 1;
    } else if (item === "shield") {
      nota += 14;
      def += 1;
    } else if (item === "haste") {
      nota += 9;
    } else if (item === "ward") {
      nota += 8;
      if (you.ward === 0) def += WARD_DEF;
    } else if (item === "potion") {
      const cura = Math.min(POTION_HEAL, HERO_HP - hp);
      hp += cura;
      nota += cura * 2.5;
    }
    for (const c of neighbors(paso)) {
      if (!cells[c].known && edgeOf(view, paso, c) === 0) nuevas.add(c);
    }
  }
  // Alumbrar terreno nuevo vale por sí mismo: ahí está el botín que falta.
  nota += nuevas.size * 2.5;

  let muerto = -1;
  if (ataque) {
    const monstruo = cells[to].monster;
    if (monstruo) {
      if (atk >= monstruo.hp) {
        muerto = to;
        nota += MONSTER[monstruo.kind].gold * 10 + 6;
      } else {
        nota += atk * 2;
      }
    } else {
      // Es el rival. Matarlo gana la partida; herirlo sólo compensa si se va
      // por delante en vida, y eso sólo lo mide el difícil.
      const golpe = damage(atk, defOf(rival));
      if (golpe >= rival.hp) return 1000;
      nota += experto && hp > rival.hp ? golpe * 6 : golpe * 1.5;
    }
  }

  // Los monstruos pegados al acabar devuelven el golpe.
  const golpes = mordiscos(view, fin, def, muerto);
  if (hp - golpes <= 0) return -1000;
  nota -= golpes * (hp - golpes <= 4 ? 7 : 3.5);

  if (experto && rival.pos !== null && !(ataque && to === rival.pos)) {
    // Acabar al alcance de un rival más fuerte es regalarle el turno.
    const aTiro = manhattan(fin, rival.pos) <= REACH;
    if (aTiro && rival.hp >= hp - golpes) nota -= 8;
    if (aTiro && damage(rival.atk, def) >= hp - golpes) nota -= 200;
  }

  // Y que el sitio donde acaba le deje cerca de lo siguiente.
  if (lejos[fin] !== Infinity) nota -= lejos[fin] * 0.9;

  return nota;
}
