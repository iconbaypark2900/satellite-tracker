/**
 * ics-export.ts — Serialize access windows to an iCalendar (RFC 5545)
 * string for import into calendar apps.
 */

import { AccessEvent } from "@/types";

/** Escape iCalendar TEXT values (RFC 5545 §3.3.11). */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** UTC timestamp in iCalendar basic format: 20260811T023000Z */
function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Fold long lines at 74 octets with a leading space (RFC 5545 §3.1). */
function foldLine(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) {
    parts.push((i === 0 ? "" : " ") + line.slice(i, i + 74));
  }
  return parts.join("\r\n");
}

/**
 * Build a VCALENDAR containing one VEVENT per access window.
 */
export function accessEventsToIcs(
  events: AccessEvent[],
  calendarName = "Satellite passes"
): string {
  const now = icsDate(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//satellite-tracker//access-planner//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];

  events.forEach((ev, i) => {
    const p = ev.pass;
    const summary = `${ev.satelliteName} pass over ${ev.stationName} (max el ${p.maxElevation.toFixed(0)}°)`;
    const description =
      `Satellite: ${ev.satelliteName} (#${ev.noradId})\n` +
      `Station: ${ev.stationName}\n` +
      `Max elevation: ${p.maxElevation.toFixed(1)}° at ${p.maxTime.toISOString()}\n` +
      `Azimuth: ${p.startAz.toFixed(0)}° → ${p.maxAz.toFixed(0)}° → ${p.endAz.toFixed(0)}°\n` +
      (p.isVisible ? "Visually observable (sunlit satellite, dark sky)" : p.isLit ? "Satellite sunlit (sky may be bright)" : "Satellite in Earth shadow");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.noradId}-${ev.stationId}-${p.startTime.getTime()}-${i}@satellite-tracker`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(p.startTime)}`,
      `DTEND:${icsDate(p.endTime)}`,
      foldLine(`SUMMARY:${icsEscape(summary)}`),
      foldLine(`DESCRIPTION:${icsEscape(description)}`),
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
