/**
 * Icon.tsx — The app's icon set.
 *
 * Replaces the emoji the UI used to draw with. Emoji come from the platform's
 * emoji font, which means the same glyph is a flat pictogram on one machine
 * and a glossy 3D render on another, they carry their own colour and ignore
 * `currentColor`, and their optical sizes and baselines disagree with each
 * other — a 🛰️ and a ⚠️ set at the same font-size do not look the same size.
 * On a dark instrument panel that reads as clip-art dropped into the chrome.
 *
 * These are drawn on a common 24×24 grid with a single stroke weight and
 * inherit colour from their parent, so an icon in a muted status row and the
 * same icon in an active nav link are the same mark in two colours.
 *
 * Icons are decorative by default (`aria-hidden`) because nearly every one
 * sits next to its own label. Pass `title` when an icon is a control's only
 * content — that promotes it to an image with an accessible name.
 */

import { CSSProperties } from "react";

export type IconName =
  | "satellite"
  | "globe"
  | "stars"
  | "calendar"
  | "signal"
  | "alert"
  | "sun"
  | "moon"
  | "eye"
  | "clock"
  | "close"
  | "play"
  | "pause"
  | "reset"
  | "chevron"
  | "pin"
  | "search"
  | "bolt";

/**
 * Geometry only — every path inherits stroke, width, and colour from the
 * wrapping <svg>, so a glyph cannot drift from the set's weight. The handful
 * of solid shapes set `fill="currentColor"` explicitly and are deliberate:
 * play and bolt read as smudges when hollow at 14px.
 */
const PATHS: Record<IconName, React.ReactNode> = {
  // Bus, two solar panels, and a dish. A body-on-an-orbit-ring mark was the
  // first attempt and reads as an eye at any size — concentric round shapes
  // are an eye before they are anything else.
  satellite: (
    <>
      <rect x="9.6" y="8.4" width="4.8" height="7.2" rx="1.2" />
      <rect x="1.8" y="9.6" width="5.6" height="4.8" rx="1" />
      <rect x="16.6" y="9.6" width="5.6" height="4.8" rx="1" />
      <path d="M7.4 12h2.2M14.4 12h2.2" />
      <path d="M12 8.4V5.6" />
      <path d="M9.9 4.6a3.2 3.2 0 0 1 4.2 0" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M3.2 12h17.6" />
      <ellipse cx="12" cy="12" rx="4" ry="8.8" />
    </>
  ),
  // Night sky rather than a telescope: a tube-and-tripod turns to mush at
  // this size, and the Sky view is about what is overhead, not the optics.
  stars: (
    <>
      <path d="M13 3.5 14.85 8.15 19.5 10 14.85 11.85 13 16.5 11.15 11.85 6.5 10 11.15 8.15z" />
      <circle cx="6.4" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18.6" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10.2h17M8.2 3.2v4.4M15.8 3.2v4.4" />
    </>
  ),
  // Transmission: a source between two pairs of arcs. Used for ground
  // stations and for TLE freshness — both are "is data coming in".
  signal: (
    <>
      <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6" />
      <path d="M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.8v4.4" />
      <circle cx="12" cy="17.6" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.4v2.3M12 19.3v2.3M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.4 12h2.3M19.3 12h2.3M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
    </>
  ),
  moon: <path d="M20.2 14.8A8.6 8.6 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11z" />,
  eye: (
    <>
      <path d="M2.4 12S6.1 5.6 12 5.6 21.6 12 21.6 12 17.9 18.4 12 18.4 2.4 12 2.4 12z" />
      <circle cx="12" cy="12" r="2.9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 6.8V12l3.6 2.1" />
    </>
  ),
  close: <path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8" />,
  play: <path d="M8.4 5.2v13.6L19 12z" fill="currentColor" stroke="none" />,
  pause: <path d="M9.4 5.4v13.2M14.6 5.4v13.2" />,
  reset: (
    <>
      <path d="M3.6 12a8.4 8.4 0 1 0 2.5-6" />
      <path d="M3.2 3.6v4.6h4.6" />
    </>
  ),
  chevron: <path d="M9.2 5.4 15.8 12l-6.6 6.6" />,
  pin: (
    <>
      <path d="M12 21.2s6.8-6.3 6.8-11a6.8 6.8 0 1 0-13.6 0c0 4.7 6.8 11 6.8 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.4" cy="10.4" r="6.4" />
      <path d="M15.1 15.1 20.8 20.8" />
    </>
  ),
  bolt: (
    <path
      d="M13.4 2.4 4.6 13.6h6.2l-1 8 8.6-11.2H12z"
      fill="currentColor"
      stroke="none"
    />
  ),
};

interface Props {
  name: IconName;
  /** Edge length in px. Defaults to 1em so icons track their text. */
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  /**
   * Accessible name. Set this only when the icon carries meaning no adjacent
   * text repeats — an icon-only button. Omitting it leaves the icon hidden
   * from assistive tech, which is correct beside a visible label.
   */
  title?: string;
}

export default function Icon({ name, size = "1em", className, style, title }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Nudged off the text baseline so a 1em icon sits optically centred
      // against lowercase text rather than riding high on it.
      style={{ flexShrink: 0, verticalAlign: "-0.14em", ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}

/**
 * An icon and its label as one unit. Buttons and links used to write
 * `"📍 Use My Location"` — a single string where the space between glyph and
 * text was whatever the emoji font shipped. This centres them against each
 * other and keeps one gap value across the app.
 */
export function IconLabel({
  icon,
  children,
  gap = "0.35rem",
}: {
  icon: IconName;
  children: React.ReactNode;
  gap?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap }}>
      <Icon name={icon} />
      <span>{children}</span>
    </span>
  );
}
