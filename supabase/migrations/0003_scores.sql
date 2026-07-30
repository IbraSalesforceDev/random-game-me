-- Marcador de la sala, por juego:
--   {"tictactoe": {"host": 3, "guest": 1, "draws": 2}}
-- Vive en la sala y no en el estado del juego, para que sobreviva a las
-- revanchas y a los cambios de juego.
alter table public.games
  add column if not exists scores jsonb not null default '{}'::jsonb;
