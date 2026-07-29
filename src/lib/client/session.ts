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

export const submitShips = (code: string, ships: unknown) =>
  post(code, "ships", { ships }).then((b) => b.view as PlayerView);

export const fire = (code: string, x: number, y: number) =>
  post(code, "fire", { x, y }).then((b) => b as { hit: boolean; view: PlayerView });

export const requestRematch = (code: string) =>
  post(code, "rematch").then((b) => b.view as PlayerView);
