/**
 * Genera un archivo .ics que el usuario puede importar a su app de calendario
 * (iOS Calendar, Google Calendar, Outlook, etc.) para programar la alarma WBTB.
 *
 * Funciona offline, sin backend, y la alarma del SO es muchísimo más fiable
 * que cualquier setTimeout en el navegador (que muere si la pestaña se cierra
 * o el dispositivo se duerme).
 */

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatICSDate(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

export interface ICSAlarmConfig {
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  reminderMinutesBefore?: number;
}

export function buildICS(cfg: ICSAlarmConfig): string {
  const uid = `frequency-healer-${cfg.startsAt.getTime()}@frequency-healer.app`;
  const dtstart = formatICSDate(cfg.startsAt);
  const dtend = formatICSDate(
    new Date(cfg.startsAt.getTime() + cfg.durationMinutes * 60 * 1000)
  );
  const dtstamp = formatICSDate(new Date());

  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  const reminder = cfg.reminderMinutesBefore ?? 0;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Frequency Healer//Session Scheduler//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escape(cfg.title)}`,
    `DESCRIPTION:${escape(cfg.description)}`,
    'BEGIN:VALARM',
    `TRIGGER:-PT${reminder}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(cfg.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadICS(filename: string, cfg: ICSAlarmConfig): void {
  const ics = buildICS(cfg);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : filename + '.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
