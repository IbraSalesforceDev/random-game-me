-- La sala deja de saber de barcos: pasa a guardar qué juego se eligió y un
-- estado opaco cuya forma decide cada juego.
alter table public.games
  add column if not exists game  text,
  add column if not exists state jsonb;

alter table public.games
  drop column if exists host_ships,
  drop column if exists guest_ships,
  drop column if exists host_shots,
  drop column if exists guest_shots;

-- 'placing' era una fase del hundir la flota, no de la sala: ahora vive dentro
-- de `state`. En su lugar aparece 'choosing', mientras deciden a qué jugar.
-- La restricción antigua no conoce 'choosing', así que se retira primero.
alter table public.games drop constraint if exists games_status_check;

update public.games set status = 'choosing' where status = 'placing';

alter table public.games
  add constraint games_status_check
  check (status in ('waiting', 'choosing', 'playing', 'finished'));
