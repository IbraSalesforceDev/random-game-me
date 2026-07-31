-- Salas en solitario: el hueco de invitado lo ocupa el bot y aquí se guarda
-- con qué nivel juega. Null significa que el rival es una persona.
alter table public.games
  add column if not exists bot_level text
    check (bot_level in ('easy', 'medium', 'hard'));
