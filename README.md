# ⚔️ Piques

Juegos para dos personas, cada una desde su móvil. Uno crea la sala, comparte un
código de 4 letras, el otro entra y entre los dos eligen a qué jugar. Sin
registro ni instalación.

Ahora mismo hay **tres en raya**, **conecta 4**, **damas** y **hundir la flota**.
Y si no hay rival a mano, se puede jugar **contra el bot** en tres niveles
(en todos menos en el hundir la flota, de momento).

**Stack:** Next.js (App Router) en Vercel + Supabase (Postgres y Realtime).

## Cómo funciona

- **Sala por código.** Crear partida genera un código tipo `A7K2`; el rival lo teclea
  o abre el enlace compartido. Sin cuentas: cada jugador guarda un token en el
  `localStorage` del navegador, así que puede recargar sin perder la partida.
- **Sincronización.** El servidor emite un aviso por Supabase Realtime cada vez que
  cambia la partida y el cliente recarga su estado. Como red de seguridad hay un
  sondeo cada 3 s, en pausa cuando la pestaña está en segundo plano.
- **Un juego por partida.** Cuando los dos están dentro aparece el selector:
  elige cualquiera y empieza al instante para ambos. Al acabar se puede repetir
  el mismo juego, cambiar a otro, o salir — las dos primeras se quedan en la
  sala.
- **Marcador por sala.** Cada juego lleva su propia cuenta de victorias y
  empates, visible al terminar y en el selector. Vive en la sala, así que
  sobrevive a las revanchas y a los cambios de juego.
- **Tres en raya.** Tablero de 3×3. Tres seguidas y ganas; si se llena sin
  línea, empate.
- **Conecta 4.** Tablero de 7×6. Alinea cuatro fichas en horizontal, vertical o
  diagonal. Si se llena sin línea, empate.
- **Damas.** Reglas españolas: comer es obligatorio y encadenado, el peón
  avanza y come sólo hacia delante, y al coronar la dama recorre la diagonal
  entera. Coronar termina el turno. Pierde quien se queda sin piezas o sin
  movimientos.
- **Hundir la flota.** Flota clásica de 5 barcos (17 casillas). No pueden
  tocarse entre sí, ni siquiera en diagonal. Acertar da otro disparo, fallar
  cede el turno.

### Por qué no hay WebSockets propios

Vercel es serverless: las funciones se apagan al responder, así que no pueden
mantener una conexión abierta. Supabase Realtime pone esa conexión persistente y
Vercel se queda con lo que hace bien (el frontend y la API). Las escrituras usan
un contador `version` para que dos acciones simultáneas no se pisen.

### El bot

Los juegos pueden implementar una quinta función opcional, `bot`, que elige la
jugada del rival. Un juego que no la tenga simplemente no aparece cuando juegas
en solitario.

El bot corre **en el servidor**, dentro de la misma petición que tu jugada. Es
la única opción sensata: en el cliente necesitaría ver su propio estado —la
flota, en el hundir la flota— y con eso se cae todo el diseño de privacidad.
Además el contador `version` que ya evita jugadas duplicadas cubre gratis la
del bot.

El motor es un minimax con poda alfa-beta compartido
([`src/lib/games/bot/minimax.ts`](src/lib/games/bot/minimax.ts)). No asume que
los turnos se alternen: cada jugada devuelve a quién le toca, así que una
cadena de capturas o un tiro extra encajan sin tocar nada. Cada juego sólo
aporta su función de evaluación.

La dificultad son dos números: cuántas jugadas mira por delante y con qué
probabilidad tira al azar a propósito. En el tres en raya, que es un juego
resuelto, el nivel difícil es matemáticamente imbatible.

Una sala en solitario es una sala normal: el hueco de invitado lo ocupa el bot,
así que revancha, marcador y cambio de juego funcionan sin nada especial.

### Añadir un juego nuevo

La sala no sabe a qué se juega. Guarda `game` (qué juego) y `state` (un jsonb
cuya forma decide cada juego), y delega las reglas en un módulo que implementa
el contrato de [`src/lib/games/types.ts`](src/lib/games/types.ts):

- `createState()` — la posición inicial
- `initialTurn()` — quién abre, o `null` si hay una fase sin turnos
- `applyMove(state, side, move)` — valida y aplica, devolviendo turno y ganador
- `toView(state, side)` — qué puede ver cada jugador
- `bot(state, side, nivel)` — opcional, para poder jugar en solitario

Escribes el módulo, lo añades al registro de [`src/lib/games/index.ts`](src/lib/games/index.ts)
y le pones interfaz. Salas, turnos, Realtime, revancha y reconexión ya funcionan.

Las fases propias de un juego van dentro de `state`, no en el estado de la sala:
colocar la flota es una fase del hundir la flota, y por eso la sala sólo conoce
`waiting`, `choosing`, `playing` y `finished`.

### Nadie puede ver tu flota

La tabla `games` tiene RLS activo **y ninguna policy**, así que la clave anónima del
navegador no puede leerla: no sirve de nada abrir las herramientas de desarrollador.
Todo el acceso pasa por las rutas de API del servidor, que usan la `service_role` key
y llaman al `toView` del juego, que decide qué ve cada jugador. En el hundir la
flota eso significa tu flota, tus disparos y del rival sólo los barcos ya
hundidos; en el conecta 4 no hay nada que ocultar y los dos ven lo mismo.

## Puesta en marcha

### 1. Base de datos

La tabla ya está creada en tu proyecto de Supabase. Si necesitas recrearla (o usar
otro proyecto), ejecuta [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
en el SQL Editor.

### 2. Variables de entorno

En **Supabase → Project Settings → API**:

| Variable | Dónde encontrarla |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave `anon` / `publishable` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` (**secreta**) |

> ⚠️ La `service_role` key salta el RLS. Nunca la pongas en una variable con
> prefijo `NEXT_PUBLIC_` ni la subas al repositorio.

### 3. Local

```bash
npm install
cp .env.example .env.local   # y rellena las tres variables
npm run dev
```

Para probar a los dos jugadores en el mismo ordenador, abre la segunda pestaña en
una ventana de incógnito: los tokens viven en el `localStorage` del navegador y si
no, ambas pestañas jugarían como el mismo jugador.

### 4. Desplegar en Vercel

```bash
npx vercel
```

Añade las tres variables en **Project Settings → Environment Variables** y vuelve a
desplegar. No hace falta más configuración.

## Estructura

```
src/
  app/
    page.tsx                    portada: crear o unirse
    game/[code]/                sala: selector, partida y resultado
    api/games/                  crear, unirse, elegir, mover, estado, revancha
  components/
    GamePicker.tsx              selector de juego
    Scoreboard.tsx              marcador de la sala
    battleship/                 tablero, colocación y partida
    connect4/                   tablero de fichas
    checkers/                   tablero de damas
    tictactoe/                  tablero de 3×3
  lib/
    games/
      types.ts                  contrato que implementa cada juego
      index.ts                  registro de juegos disponibles
      bot/                      motor minimax compartido
      tictactoe/                reglas y módulo
      connect4/                 reglas y módulo
      checkers/                 reglas y módulo
      battleship/               reglas y módulo
    client/                     llamadas a la API y sincronización
    server/                     acceso a la base de datos y estado de la sala
supabase/migrations/            esquema SQL
```
