/**
 * Cola del cartel «Turno del rival». Contra el bot la respuesta llega dentro
 * de la misma petición, así que sin una señal de que está decidiendo la jugada
 * aparece de golpe y no se lee como un turno. Con un humano no hay nada que
 * anunciar y se queda en los puntos suspensivos de siempre.
 */
export default function Thinking({ active }: { active: boolean }) {
  if (!active) return <>…</>;

  return (
    <span
      className="animate-think inline-flex items-center gap-[0.15rem] pl-0.5"
      aria-label="pensando"
    >
      <span className="size-1 rounded-full bg-current" />
      <span className="size-1 rounded-full bg-current" />
      <span className="size-1 rounded-full bg-current" />
    </span>
  );
}
