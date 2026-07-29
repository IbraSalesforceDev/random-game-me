import type { PlayerView } from "@/lib/server/games";

const tokenKey = (code: string) => `hlf:token:${code.toUpperCase()}`;

export function getToken(code: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(tokenKey(code));
}

export function saveToken(code: string, token: string) {
  window.localStorage.setItem(tokenKey(code), token);
}

async function parse(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? "Algo ha fallado");
  return body;
}

export async function createGame(): Promise<{ code: string; token: string }> {
  return parse(await fetch("/api/games", { method: "POST" }));
}

/** Entra en la partida (o reconecta si ya teníamos token guardado). */
export async function joinGame(code: string): Promise<{ token: string; view: PlayerView }> {
  const body = await parse(
    await fetch(`/api/games/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: getToken(code) }),
    }),
  );
  saveToken(code, body.token);
  return body;
}

export async function fetchState(code: string): Promise<PlayerView> {
  const token = getToken(code);
  const body = await parse(
    await fetch(`/api/games/${code}/state?token=${encodeURIComponent(token ?? "")}`, {
      cache: "no-store",
    }),
  );
  return body.view;
}

async function post(code: string, path: string, payload: Record<string, unknown> = {}) {
  return parse(
    await fetch(`/api/games/${code}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, token: getToken(code) }),
    }),
  );
}

export const chooseGame = (code: string, game: string) =>
  post(code, "choose", { game }).then((b) => b.view as PlayerView);

/** Envía un movimiento. Su forma la define cada juego. */
export const sendMove = (code: string, move: unknown) =>
  post(code, "move", { move }).then((b) => b.view as PlayerView);

/** `replay` repite el mismo juego; sin él se vuelve al selector. */
export const requestRematch = (code: string, replay = false) =>
  post(code, "rematch", { replay }).then((b) => b.view as PlayerView);
