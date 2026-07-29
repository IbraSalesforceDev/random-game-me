-- Tabla única del juego. Guarda las dos flotas y los disparos de cada jugador.
create table if not exists public.games (
  code        text primary key,
  status      text not null default 'waiting'
                check (status in ('waiting', 'placing', 'playing', 'finished')),
  host_token  text not null,
  guest_token text,
  host_ships  jsonb,
  guest_ships jsonb,
  host_shots  jsonb not null default '[]'::jsonb,
  guest_shots jsonb not null default '[]'::jsonb,
  turn        text check (turn in ('host', 'guest')),
  winner      text check (winner in ('host', 'guest')),
  version     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists games_updated_at_idx on public.games (updated_at);

-- RLS activo y SIN policies a propósito: así la clave anónima del navegador no
-- puede leer la tabla y nadie puede espiar la flota del rival. Todo el acceso
-- pasa por las rutas de API del servidor, que usan la service role key.
alter table public.games enable row level security;

-- Limpieza de partidas viejas. Se puede llamar desde un cron de Supabase:
--   select cron.schedule('purge-games', '0 4 * * *', $$select public.purge_old_games()$$);
create or replace function public.purge_old_games()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.games where updated_at < now() - interval '2 days' returning 1
  )
  select count(*)::integer from deleted;
$$;
