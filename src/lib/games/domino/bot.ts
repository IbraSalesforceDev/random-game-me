import {
  ends,
  isDouble,
  MAX_PIP,
  pips,
  place,
  type Play,
  sameTile,
  type Tile,
} from "@/lib/games/domino/rules";
import {
  type DominoMove,
  type DominoState,
  type DominoView,
  viewFor,
} from "@/lib/games/domino/state";
import type { BotLevel, Side } from "@/lib/games/types";

/**
 * El bot del dominó no puede usar el minimax de los demás juegos: aquel asume
 * información perfecta y aquí la mano del rival está tapada y además se roba
 * del pozo al azar. Juega valorando cada jugada.
 *
 * Trabaja sobre `viewFor`, la misma vista que recibe una persona, así que no
 * puede mirar las fichas del rival ni el orden del pozo.
 */
export function dominoBot(state: DominoState, side: Side, level: BotLevel): DominoMove | null {
  const view = viewFor(state, side);

  if (view.plays.length === 0) {
    // Sin jugada: primero el pozo, y sólo cuando se agota se pasa.
    return view.poolCount > 0 ? { type: "draw" } : { type: "pass" };
  }

  if (level === "easy") {
    return toMove(view.plays[Math.floor(Math.random() * view.plays.length)]);
  }

  const experto = level === "hard";
  let mejor = view.plays[0];
  let mejorNota = -Infinity;

  for (const play of view.plays) {
    // El desempate al azar es imprescindible aunque no se busque hacerlo peor:
    // sin él, ante dos jugadas igual de buenas elegiría siempre la primera de
    // la mano, que es un sesgo fijo y encima malo. El normal además lleva
    // ruido de verdad, para que se le pueda ganar.
    const ruido = experto ? Math.random() * 0.01 : Math.random() * 5;
    const nota = valorar(view, play, experto) + ruido;
    if (nota > mejorNota) {
      mejorNota = nota;
      mejor = play;
    }
  }

  return toMove(mejor);
}

const toMove = (play: Play): DominoMove => ({
  type: "play",
  tile: play.tile,
  end: play.end,
});

const contiene = (t: Tile, v: number) => t[0] === v || t[1] === v;

/**
 * Cuántas fichas con ese valor siguen sin verse. De cada valor hay siete en el
 * juego; quitando las de tu mano y las de la mesa, el resto está repartido
 * entre el rival y el pozo. Cuantas menos queden, más difícil le pones que
 * pueda colocar.
 */
function sinVer(view: DominoView, v: number): number {
  const mias = view.yourHand.filter((t) => contiene(t, v)).length;
  const mesa = view.chain.filter((t) => contiene(t, v)).length;
  return Math.max(0, MAX_PIP + 1 - mias - mesa);
}

/** Cuántas fichas de la mano seguirían encajando tras colocar ésta. */
function flexibilidad(hand: Tile[], chain: Tile[], jugada: Play): number {
  const resto = quitar(hand, jugada.tile);
  return resto.filter((t) => chain.length === 0 || contiene(t, chain[0][0]) || contiene(t, chain[chain.length - 1][1])).length;
}

function quitar(hand: Tile[], tile: Tile): Tile[] {
  const i = hand.findIndex((t) => sameTile(t, tile));
  return i < 0 ? hand : [...hand.slice(0, i), ...hand.slice(i + 1)];
}

function valorar(view: DominoView, jugada: Play, experto: boolean): number {
  const despues = place(view.chain, jugada.tile, jugada.end);
  const puntas = ends(despues);

  let nota = 0;

  // Cerrar la partida ganándola manda sobre cualquier otra consideración.
  if (view.yourHand.length === 1) return 1000;

  // Los dobles son los más difíciles de colocar: cuanto antes te los quites,
  // menos posibilidades tienes de comértelos en un cierre.
  if (isDouble(jugada.tile)) nota += 12;

  // Soltar lo gordo: si la partida se cierra, gana quien menos puntos tenga.
  nota += pips(jugada.tile) * 0.6;

  // No quedarse sin salida: se premia conservar fichas que sigan encajando.
  nota += flexibilidad(view.yourHand, despues, jugada) * 3;

  if (experto && puntas) {
    // Dejar las puntas en valores de los que quedan pocas fichas por ver es
    // lo que de verdad ahoga al rival, y se puede calcular desde la primera
    // jugada. Con las dos puntas iguales sólo le sirve ese valor, así que
    // cuenta una vez: es la mitad de salidas para él.
    const valores = puntas[0] === puntas[1] ? [puntas[0]] : [puntas[0], puntas[1]];
    const salidas = valores.reduce((n, v) => n + sinVer(view, v), 0);
    nota -= salidas * 2.5;

    // Y si además ha pasado con alguno de esos valores, sabemos seguro que no
    // lo tiene: con el pozo vacío ya no puede conseguirlo, así que es letal.
    const falta = new Set(view.rivalLacks);
    const ahogadas = valores.filter((v) => falta.has(v)).length;
    nota += ahogadas === valores.length ? 40 : ahogadas * 14;
  }

  return nota;
}
