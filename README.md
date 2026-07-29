# 🚢 Hundir la Flota

Juego de hundir la flota para dos personas, cada una desde su móvil. Uno crea la
partida, comparte un código de 4 letras y el otro entra. Sin registro ni instalación.

**Stack:** Next.js (App Router) en Vercel + Supabase (Postgres y Realtime).

## Cómo funciona

- **Sala por código.** Crear partida genera un código tipo `A7K2`; el rival lo teclea
  o abre el enlace compartido. Sin cuentas: cada jugador guarda un token en el
  `localStorage` del navegador, así que puede recargar sin perder la partida.
- **Sincronización.** El servidor emite un aviso por Supabase Realtime cada vez que
  cambia la partida y el cliente recarga su estado. Como red de seguridad hay un
  sondeo cada 3 s, en pausa cuando la pestaña está en segundo plano.
- **Reglas.** Flota clásica de 5 barcos (17 casillas). Acertar da otro disparo,
  fallar cede el turno. Gana quien hunda los 5 barcos rivales.

### Por qué no hay WebSockets propios

Vercel es serverless: las funciones se apagan al responder, así que no pueden
mantener una conexión abierta. Supabase Realtime pone esa conexión persistente y
Vercel se queda con lo que hace bien (el frontend y la API). Las escrituras usan
un contador `version` para que dos acciones simultáneas no se pisen.

### Nadie puede ver tu flota

La tabla `games` tiene RLS activo **y ninguna policy**, así que la clave anónima del
navegador no puede leerla: no sirve de nada abrir las herramientas de desarrollador.
Todo el acceso pasa por las rutas de API del servidor, que usan la `service_role` key
y devuelven a cada jugador sólo lo que le corresponde — tu flota, tus disparos, y
del rival únicamente los barcos que ya has hundido.

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

Para probar los dos jugadores en el mismo ordenador, abre la segunda pestaña en
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
    game/[code]/                pantalla de partida
    api/games/                  crear, unirse, colocar, disparar, estado, revancha
  components/
    Board.tsx                   tablero 10×10 reutilizable
    Placement.tsx               colocación de la flota
    Play.tsx                    partida en curso
  lib/
    battleship.ts               reglas del juego (sin dependencias)
    client/                     llamadas a la API y sincronización
    server/                     acceso a la base de datos y filtrado del estado
supabase/migrations/            esquema SQL
```
