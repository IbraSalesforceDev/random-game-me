import type { Side } from "@/lib/games/types";

export const W = 13;
export const H = 15;
export const CELLS = W * H;
/** Casilla central: es su propia simétrica y guarda el cofre. */
export const CENTER = (CELLS - 1) / 2;

/** Pasos que da un héroe por turno. Atacar gasta uno. */
export const REACH = 4;
/** Hasta dónde alumbra la antorcha, en casillas en cualquier dirección. */
export const SIGHT = 2;
export const TURNS = 30;

export const HERO_HP = 12;
export const HERO_ATK = 2;
export const POTION_HEAL = 4;
export const CHEST_GOLD = 5;

export type MonsterKind = "rat" | "goblin" | "skeleton" | "orc";
export type Monster = { kind: MonsterKind; hp: number };
export type Item = "gold" | "potion" | "sword" | "shield" | "chest";

export const MONSTER: Record<MonsterKind, { hp: number; atk: number; gold: number; name: string }> = {
  rat: { hp: 2, atk: 1, gold: 1, name: "la rata" },
  goblin: { hp: 3, atk: 2, gold: 2, name: "el goblin" },
  skeleton: { hp: 5, atk: 2, gold: 2, name: "el esqueleto" },
  // El orco es el único que duele de verdad: sin escudo o sin espada, mejor rodearlo.
  orc: { hp: 6, atk: 3, gold: 3, name: "el orco" },
};

/**
 * Daño de un golpe. El escudo resta, pero un golpe que entra siempre hace al
 * menos uno: si no, dos escudos volverían a un héroe intocable.
 */
export const damage = (atk: number, def: number) => Math.max(1, atk - def);

export type Hero = { pos: number; hp: number; atk: number; def: number; gold: number };

/** Mapa y contenido. Las listas van por índice de casilla, fila a fila. */
export type Board = {
  walls: number[];
  items: (Item | null)[];
  monsters: (Monster | null)[];
};

export const START: Record<Side, number> = {
  host: (H - 1) * W,
  guest: W - 1,
};

const xy = (i: number) => [i % W, Math.floor(i / W)] as const;

/** Vecinas en cruz: por ahí se camina y se pega. */
export function neighbors(i: number): number[] {
  const [x, y] = xy(i);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < W - 1) out.push(i + 1);
  if (y > 0) out.push(i - W);
  if (y < H - 1) out.push(i + W);
  return out;
}

/** Casillas que alumbra la antorcha desde una posición. */
export function lit(from: number): number[] {
  const [x, y] = xy(from);
  const out: number[] = [];
  for (let dy = -SIGHT; dy <= SIGHT; dy++) {
    for (let dx = -SIGHT; dx <= SIGHT; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) out.push(ny * W + nx);
    }
  }
  return out;
}

export const manhattan = (a: number, b: number) => {
  const [ax, ay] = xy(a);
  const [bx, by] = xy(b);
  return Math.abs(ax - bx) + Math.abs(ay - by);
};

export type Reach = Record<number, { d: number; prev: number }>;

/** Búsqueda en anchura desde `from` por las casillas que deje pasar `open`. */
export function flood(from: number, open: (i: number) => boolean, max = Infinity): Reach {
  const out: Reach = { [from]: { d: 0, prev: -1 } };
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    const d = out[cur].d;
    if (d >= max) continue;
    for (const n of neighbors(cur)) {
      if (n in out || !open(n)) continue;
      out[n] = { d: d + 1, prev: cur };
      queue.push(n);
    }
  }
  return out;
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

const mirror = (i: number) => CELLS - 1 - i;

/**
 * Genera una mazmorra simétrica respecto al centro: lo que un jugador tiene a
 * tres pasos, el otro lo tiene a tres pasos en su lado. Sin eso, el azar del
 * mapa decidiría la partida antes de empezar.
 */
export function generate(): Board {
  for (let intento = 0; intento < 200; intento++) {
    const walls = new Array<number>(CELLS).fill(0);
    const libres = new Set([
      START.host,
      START.guest,
      CENTER,
      ...neighbors(START.host),
      ...neighbors(START.guest),
      ...neighbors(CENTER),
    ]);
    for (let i = 0; i < CENTER; i++) {
      if (libres.has(i) || Math.random() > 0.24) continue;
      walls[i] = 1;
      walls[mirror(i)] = 1;
    }

    // Lo que no se alcanza desde la salida se tapia: no puede haber botín
    // encerrado. Por la simetría, lo que alcanza uno lo alcanza el otro.
    const alcanzable = flood(START.host, (i) => !walls[i]);
    if (!(START.guest in alcanzable)) continue;
    let suelo = 0;
    for (let i = 0; i < CELLS; i++) {
      if (i in alcanzable) suelo++;
      else walls[i] = 1;
    }
    if (suelo < 130) continue;

    const items = new Array<Item | null>(CELLS).fill(null);
    const monsters = new Array<Monster | null>(CELLS).fill(null);
    const centro = new Set([CENTER, ...neighbors(CENTER)]);
    const huecos = shuffled(
      Array.from({ length: CENTER }, (_, i) => i).filter(
        (i) =>
          !walls[i] &&
          !centro.has(i) &&
          manhattan(i, START.host) > 3 &&
          manhattan(i, START.guest) > 3,
      ),
    );
    if (huecos.length < 16) continue;

    const poner = (n: number, fn: (i: number) => void) => {
      for (let k = 0; k < n; k++) {
        const i = huecos.pop()!;
        fn(i);
        fn(mirror(i));
      }
    };
    const bicho = (kind: MonsterKind) => (i: number) =>
      (monsters[i] = { kind, hp: MONSTER[kind].hp });
    poner(6, (i) => (items[i] = "gold"));
    poner(2, (i) => (items[i] = "potion"));
    poner(1, (i) => (items[i] = "sword"));
    poner(1, (i) => (items[i] = "shield"));
    poner(3, bicho("rat"));
    poner(2, bicho("goblin"));
    poner(1, bicho("orc"));

    // El cofre va en el centro, con un esqueleto a cada lado.
    items[CENTER] = "chest";
    monsters[CENTER - 1] = { kind: "skeleton", hp: MONSTER.skeleton.hp };
    monsters[CENTER + 1] = { kind: "skeleton", hp: MONSTER.skeleton.hp };

    return { walls, items, monsters };
  }
  throw new Error("No se pudo generar la mazmorra");
}
