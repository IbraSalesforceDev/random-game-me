import { NextResponse } from "next/server";
import { allSunk, BOARD_SIZE, cellKey, isHit, type Shot } from "@/lib/battleship";
import { type GameRow, other, shipsOf, shotsOf, toPlayerView } from "@/lib/server/games";
import { isResponse, loadGameForToken } from "@/lib/server/load";
import { broadcastGameUpdate, supabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

const isCoord = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;

/** Dispara a una casilla del tablero rival. Si aciertas, repites turno. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const token: string | null = typeof body?.token === "string" ? body.token : null;

  const loaded = await loadGameForToken(code, token);
  if (isResponse(loaded)) return loaded;
  const { game, side } = loaded;

  if (game.status !== "playing") {
    return NextResponse.json({ error: "La partida no está en juego" }, { status: 409 });
  }
  if (game.turn !== side) {
    return NextResponse.json({ error: "No es tu turno" }, { status: 409 });
  }
  if (!isCoord(body?.x) || !isCoord(body?.y)) {
    return NextResponse.json({ error: "Casilla no válida" }, { status: 400 });
  }

  const { x, y } = body as Shot;
  const myShots = shotsOf(game, side);
  if (myShots.some((s) => cellKey(s.x, s.y) === cellKey(x, y))) {
    return NextResponse.json({ error: "Ya has disparado ahí" }, { status: 409 });
  }

  const opponentShips = shipsOf(game, other(side)) ?? [];
  const hit = isHit(opponentShips, x, y);
  const shots = [...myShots, { x, y }];
  const won = hit && allSunk(opponentShips, shots);

  const patch: Record<string, unknown> = {
    [side === "host" ? "host_shots" : "guest_shots"]: shots,
    // Acertar da otro tiro; fallar cede el turno.
    turn: won ? null : hit ? side : other(side),
    status: won ? "finished" : "playing",
    winner: won ? side : null,
    version: game.version + 1,
    updated_at: new Date().toISOString(),
  };

  // El filtro por `version` hace que dos disparos simultáneos no se pisen.
  const { data, error } = await supabaseAdmin()
    .from("games")
    .update(patch)
    .eq("code", game.code)
    .eq("version", game.version)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "No se pudo disparar" }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "La partida cambió, inténtalo de nuevo" }, { status: 409 });
  }

  await broadcastGameUpdate(game.code);
  return NextResponse.json({ hit, view: toPlayerView(data as GameRow, side) });
}
