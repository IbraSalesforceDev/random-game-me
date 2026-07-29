export const BOARD_SIZE = 10;

export type ShipKind = {
  id: string;
  name: string;
  size: number;
};

/** Flota clásica: 17 casillas repartidas en 5 barcos. */
export const FLEET: ShipKind[] = [
  { id: "carrier", name: "Portaaviones", size: 5 },
  { id: "battleship", name: "Acorazado", size: 4 },
  { id: "cruiser", name: "Crucero", size: 3 },
  { id: "submarine", name: "Submarino", size: 3 },
  { id: "destroyer", name: "Destructor", size: 2 },
];

export const TOTAL_SHIP_CELLS = FLEET.reduce((n, s) => n + s.size, 0);

export type Ship = {
  id: string;
  x: number;
  y: number;
  horizontal: boolean;
};

export type Shot = { x: number; y: number };
export type ResolvedShot = Shot & { hit: boolean };

export const cellKey = (x: number, y: number) => `${x},${y}`;

export function shipKind(id: string): ShipKind | undefined {
  return FLEET.find((s) => s.id === id);
}

export function shipCells(ship: Ship): Shot[] {
  const kind = shipKind(ship.id);
  if (!kind) return [];
  const cells: Shot[] = [];
  for (let i = 0; i < kind.size; i++) {
    cells.push({
      x: ship.horizontal ? ship.x + i : ship.x,
      y: ship.horizontal ? ship.y : ship.y + i,
    });
  }
  return cells;
}

function inBounds({ x, y }: Shot) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

/**
 * Comprueba que una colocación es legal: un barco de cada tipo de la flota,
 * dentro del tablero y sin solaparse entre ellos.
 */
export function validateFleet(ships: unknown): ships is Ship[] {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return false;

  const seen = new Set<string>();
  const occupied = new Set<string>();

  for (const raw of ships) {
    if (!raw || typeof raw !== "object") return false;
    const ship = raw as Ship;
    if (
      typeof ship.id !== "string" ||
      typeof ship.x !== "number" ||
      typeof ship.y !== "number" ||
      typeof ship.horizontal !== "boolean" ||
      !Number.isInteger(ship.x) ||
      !Number.isInteger(ship.y)
    ) {
      return false;
    }
    if (!shipKind(ship.id) || seen.has(ship.id)) return false;
    seen.add(ship.id);

    for (const cell of shipCells(ship)) {
      if (!inBounds(cell)) return false;
      const key = cellKey(cell.x, cell.y);
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }

  return seen.size === FLEET.length;
}

/** Comprueba si un único barco cabe en el tablero sin chocar con `others`. */
export function canPlace(ship: Ship, others: Ship[]): boolean {
  const occupied = new Set(
    others.filter((o) => o.id !== ship.id).flatMap(shipCells).map((c) => cellKey(c.x, c.y)),
  );
  return shipCells(ship).every((c) => inBounds(c) && !occupied.has(cellKey(c.x, c.y)));
}

/** Genera una flota completa colocada al azar. */
export function randomFleet(): Ship[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const ships: Ship[] = [];
    let ok = true;

    for (const kind of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const horizontal = Math.random() < 0.5;
        const span = kind.size - 1;
        const candidate: Ship = {
          id: kind.id,
          x: Math.floor(Math.random() * (BOARD_SIZE - (horizontal ? span : 0))),
          y: Math.floor(Math.random() * (BOARD_SIZE - (horizontal ? 0 : span))),
          horizontal,
        };
        if (canPlace(candidate, ships)) {
          ships.push(candidate);
          placed = true;
        }
      }
      if (!placed) {
        ok = false;
        break;
      }
    }

    if (ok) return ships;
  }
  throw new Error("No se pudo generar una flota aleatoria");
}

export function isHit(ships: Ship[], x: number, y: number): boolean {
  const key = cellKey(x, y);
  return ships.some((ship) => shipCells(ship).some((c) => cellKey(c.x, c.y) === key));
}

/** Barcos de `ships` completamente tocados por `shots`. */
export function sunkShips(ships: Ship[], shots: Shot[]): Ship[] {
  const fired = new Set(shots.map((s) => cellKey(s.x, s.y)));
  return ships.filter((ship) => shipCells(ship).every((c) => fired.has(cellKey(c.x, c.y))));
}

export function allSunk(ships: Ship[], shots: Shot[]): boolean {
  return sunkShips(ships, shots).length === FLEET.length;
}

/** Añade a cada disparo si fue tocado o agua, según la flota objetivo. */
export function resolveShots(ships: Ship[], shots: Shot[]): ResolvedShot[] {
  return shots.map((s) => ({ ...s, hit: isHit(ships, s.x, s.y) }));
}

export const COLUMN_LABELS = "ABCDEFGHIJ".split("");

export function coordLabel(x: number, y: number) {
  return `${COLUMN_LABELS[x]}${y + 1}`;
}
