import type { Side } from "@/lib/games/types";

export const W = 15;
export const H = 17;
export const CELLS = W * H;
/** Casilla central: es su propia simétrica y guarda el cofre. */
export const CENTER = (CELLS - 1) / 2;

/** Pasos que da un héroe por turno. Atacar gasta uno. */
export const REACH = 4;
/** Hasta dónde llega la luz de la antorcha, en pasos. No atraviesa muros ni puertas cerradas. */
export const SIGHT = 3;
export const TURNS = 32;

export const HERO_HP = 12;
export const HERO_ATK = 2;
export const POTION_HEAL = 4;
export const CHEST_GOLD = 5;

/** Los potenciadores duran estos turnos propios, sin contar el de cogerlos. */
export const BUFF_TURNS = 3;
export const HASTE_STEPS = 2;
export const WARD_DEF = 2;

export type MonsterKind = "rat" | "goblin" | "skeleton" | "orc";
/** `awake` sólo cuenta en cooperativo: un monstruo que os ha visto ya no se queda quieto. */
export type Monster = { kind: MonsterKind; hp: number; awake?: boolean };
/** `haste` y `ward` son potenciadores temporales; el resto, permanente o botín. */
export type Item = "gold" | "potion" | "sword" | "shield" | "chest" | "haste" | "ward";

export const MONSTER: Record<
  MonsterKind,
  { hp: number; atk: number; gold: number; name: string; speed: number }
> = {
  // `speed` son los pasos que da al perseguir, en cooperativo: lo pequeño corre.
  rat: { hp: 2, atk: 1, gold: 1, name: "la rata", speed: 2 },
  goblin: { hp: 3, atk: 2, gold: 2, name: "el goblin", speed: 2 },
  skeleton: { hp: 5, atk: 2, gold: 2, name: "el esqueleto", speed: 1 },
  // El orco es el único que duele de verdad: sin escudo o sin espada, mejor rodearlo.
  orc: { hp: 6, atk: 3, gold: 3, name: "el orco", speed: 1 },
};

/** Oro que tiene que reunir el equipo en cooperativo. */
export const TEAM_GOAL = 24;
/** Hasta dónde sigue un monstruo despierto a un héroe, en pasos. */
export const CHASE = 9;

/**
 * Daño de un golpe. El escudo resta, pero un golpe que entra siempre hace al
 * menos uno: si no, dos escudos volverían a un héroe intocable.
 */
export const damage = (atk: number, def: number) => Math.max(1, atk - def);

export type Hero = {
  pos: number;
  hp: number;
  atk: number;
  def: number;
  gold: number;
  /** Turnos que le quedan de botas (+pasos) y de amuleto (+defensa). */
  haste: number;
  ward: number;
};

export const stepsOf = (h: Pick<Hero, "haste">) => REACH + (h.haste > 0 ? HASTE_STEPS : 0);
export const defOf = (h: Pick<Hero, "def" | "ward">) => h.def + (h.ward > 0 ? WARD_DEF : 0);

/** Lo que hay en el borde entre dos casillas. */
export const OPEN = 0;
export const WALL = 1;
export const DOOR = 2;
/** Puerta ya abierta: se queda así para los dos. */
export const AJAR = 3;

/**
 * Los muros no ocupan casilla: van en los bordes, como en un tablero de
 * mazmorras. `east[i]` es el borde entre `i` y la de su derecha; `south[i]`,
 * entre `i` y la de debajo.
 */
export type Edges = { east: number[]; south: number[] };

export type Board = Edges & {
  items: (Item | null)[];
  monsters: (Monster | null)[];
};

export const START: Record<Side, number> = {
  host: (H - 1) * W,
  guest: W - 1,
};

const xy = (i: number) => [i % W, Math.floor(i / W)] as const;

/** Vecinas en cruz, sin mirar si hay muro por medio. */
export function neighbors(i: number): number[] {
  const [x, y] = xy(i);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < W - 1) out.push(i + 1);
  if (y > 0) out.push(i - W);
  if (y < H - 1) out.push(i + W);
  return out;
}

/** Qué hay en el borde entre dos casillas vecinas. */
export function edgeOf(e: Edges, a: number, b: number): number {
  if (b === a + 1) return e.east[a];
  if (b === a - 1) return e.east[b];
  if (b === a + W) return e.south[a];
  return e.south[b];
}

export function setEdge(e: Edges, a: number, b: number, v: number) {
  if (b === a + 1) e.east[a] = v;
  else if (b === a - 1) e.east[b] = v;
  else if (b === a + W) e.south[a] = v;
  else e.south[b] = v;
}

/** Se puede pasar, pegar y ver a través: hueco libre o puerta abierta. */
export const passable = (v: number) => v === OPEN || v === AJAR;

export const manhattan = (a: number, b: number) => {
  const [ax, ay] = xy(a);
  const [bx, by] = xy(b);
  return Math.abs(ax - bx) + Math.abs(ay - by);
};

export type Reach = Record<number, { d: number; prev: number }>;

/** Búsqueda en anchura desde `from`; `step` decide si se puede pasar de una casilla a su vecina. */
export function flood(
  from: number,
  step: (cur: number, next: number) => boolean,
  max = Infinity,
): Reach {
  const out: Reach = { [from]: { d: 0, prev: -1 } };
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    const d = out[cur].d;
    if (d >= max) continue;
    for (const n of neighbors(cur)) {
      if (n in out || !step(cur, n)) continue;
      out[n] = { d: d + 1, prev: cur };
      queue.push(n);
    }
  }
  return out;
}

/** Casillas que alumbra la antorcha: la luz dobla esquinas, pero no cruza muros ni puertas cerradas. */
export function lit(e: Edges, from: number): number[] {
  return Object.keys(flood(from, (a, b) => passable(edgeOf(e, a, b)), SIGHT)).map(Number);
}

/** Camino hasta `to`, sin incluir la casilla de salida. */
export function pathTo(reach: Reach, to: number): number[] {
  const path: number[] = [];
  for (let cur = to; reach[cur] && reach[cur].prev !== -1; cur = reach[cur].prev) path.unshift(cur);
  return path;
}

function shuffled<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const mirror = (i: number) => CELLS - 1 - i;

/**
 * Genera una mazmorra de habitaciones y pasillos, simétrica respecto al
 * centro: lo que un jugador tiene a tres pasos, el otro lo tiene a tres pasos
 * en su lado. Sin eso, el azar del mapa decidiría la partida antes de empezar.
 *
 * Las habitaciones se colocan en la mitad de arriba y se copian giradas
 * abajo; la del cofre va en el centro. Lo jugoso —y lo peligroso— se guarda
 * tras las puertas.
 */
export function generate(): Board {
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;

  for (let intento = 0; intento < 500; intento++) {
    const east = new Array<number>(CELLS).fill(OPEN);
    const south = new Array<number>(CELLS).fill(OPEN);
    const edges = { east, south };
    const room = new Array<number>(CELLS).fill(-1);

    // Sala del cofre: 5×3 en el centro.
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) room[y * W + x] = 0;
    }

    let salas = 0;
    for (let k = 0; k < 60 && salas < 4; k++) {
      const w = rand(3, 5);
      const h = rand(3, 4);
      const x0 = rand(0, W - w);
      // Deja un pasillo libre encima de la sala central.
      const y0 = rand(0, cy - 2 - h);
      let cabe = true;
      for (let y = y0 - 1; y <= y0 + h && cabe; y++) {
        for (let x = x0 - 1; x <= x0 + w && cabe; x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const i = y * W + x;
          // Ni pegada a otra sala ni encima de la salida.
          if (room[i] !== -1 || manhattan(i, START.guest) <= 2) cabe = false;
        }
      }
      if (!cabe) continue;
      salas++;
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          room[y * W + x] = salas;
          room[mirror(y * W + x)] = salas + 100;
        }
      }
    }
    if (salas < 3) continue;

    // Muro en todo borde que separe una sala de lo que no es esa sala.
    const perimetro = new Map<number, [number, number][]>();
    for (let a = 0; a < CELLS; a++) {
      if (room[a] === -1) continue;
      for (const b of neighbors(a)) {
        if (room[b] === room[a]) continue;
        setEdge(edges, a, b, WALL);
        if (!perimetro.has(room[a])) perimetro.set(room[a], []);
        perimetro.get(room[a])!.push([a, b]);
      }
    }

    // Una o dos puertas por sala, y sus gemelas en la sala simétrica.
    for (const [id, bordes] of perimetro) {
      if (id >= 100) continue;
      // La central es su propia simétrica: basta abrirle una y su gemela.
      const candidatos = id === 0 ? bordes.filter(([a]) => a < CENTER) : bordes;
      const cuantas = id !== 0 && Math.random() < 0.5 ? 2 : 1;
      for (const [a, b] of shuffled(candidatos).slice(0, cuantas)) {
        setEdge(edges, a, b, DOOR);
        setEdge(edges, mirror(a), mirror(b), DOOR);
      }
    }

    // Todo tiene que poder alcanzarse abriendo puertas.
    const alcanzable = flood(START.host, (a, b) => edgeOf(edges, a, b) !== WALL);
    if (Object.keys(alcanzable).length !== CELLS) continue;

    const items = new Array<Item | null>(CELLS).fill(null);
    const monsters = new Array<Monster | null>(CELLS).fill(null);
    const mitad = Array.from({ length: CENTER }, (_, i) => i);
    const enSala = shuffled(mitad.filter((i) => room[i] > 0));
    const enPasillo = shuffled(
      mitad.filter(
        (i) => room[i] === -1 && manhattan(i, START.host) > 3 && manhattan(i, START.guest) > 3,
      ),
    );

    let falta = false;
    /** Coge un hueco, de sala o de pasillo según se prefiera, y lo usa junto con su simétrico. */
    const poner = (n: number, dentro: boolean, fn: (i: number) => void) => {
      for (let k = 0; k < n; k++) {
        const i = (dentro ? enSala.pop() ?? enPasillo.pop() : enPasillo.pop() ?? enSala.pop());
        if (i === undefined) {
          falta = true;
          return;
        }
        fn(i);
        fn(mirror(i));
      }
    };
    const bicho = (kind: MonsterKind) => (i: number) =>
      (monsters[i] = { kind, hp: MONSTER[kind].hp });
    const cosa = (item: Item) => (i: number) => (items[i] = item);

    // Tras las puertas, lo que más vale y lo que más muerde.
    poner(1, true, bicho("orc"));
    poner(2, true, bicho("goblin"));
    poner(1, true, cosa("sword"));
    poner(1, true, cosa("shield"));
    poner(1, true, cosa("haste"));
    poner(1, true, cosa("ward"));
    poner(4, true, cosa("gold"));
    // Por los pasillos, lo menudo.
    poner(3, false, bicho("rat"));
    poner(2, false, cosa("potion"));
    poner(3, false, cosa("gold"));
    if (falta) continue;

    // El cofre va en el centro, con un esqueleto a cada lado.
    items[CENTER] = "chest";
    monsters[CENTER - 1] = { kind: "skeleton", hp: MONSTER.skeleton.hp };
    monsters[CENTER + 1] = { kind: "skeleton", hp: MONSTER.skeleton.hp };

    return { east, south, items, monsters };
  }
  throw new Error("No se pudo generar la mazmorra");
}
