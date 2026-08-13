/**
 * AccuracyBadge.tsx — Surface the one claim competitors cannot casually make.
 *
 * This tracker's predictions are validated against JPL Horizons, an independent
 * authoritative ephemeris, by a script anyone can re-run
 * (`pnpm validate` → scripts/validate-vs-horizons.ts). Most trackers ask you to
 * trust them. Until now this one proved it and then buried the proof in
 * docs/VALIDATION.md, where no user would ever meet it.
 *
 * THE NUMBER IS READ FROM THE EVIDENCE, NOT TYPED IN.
 *
 * `docs/validation-results.json` is imported at build time, so the badge cannot
 * outlive the measurement behind it: re-run the validation and the badge moves;
 * delete the file and the build fails rather than shipping a confident figure
 * with nothing underneath. A hard-coded "0.023°" would be a claim that survives
 * its own evidence being deleted, which is the failure this whole project's
 * research-integrity work exists to prevent.
 *
 * Build-time rather than a runtime fetch because the file lives in docs/, not
 * public/, so it is not servable as-is — and because a broken import should
 * fail loudly at build rather than silently render an empty badge.
 */

import results from "@/docs/validation-results.json";

/** Significant-figure formatting that never rounds a small error to "0.0". */
function formatDegrees(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value < 0.01 ? value.toFixed(4) : value.toFixed(3);
}

export default function AccuracyBadge() {
  const median = results?.angularErrorDeg?.above10El?.median;
  const samples = results?.angularErrorDeg?.above10El?.n;

  // If the shape ever changes, say nothing rather than something wrong.
  if (typeof median !== "number" || !Number.isFinite(median)) return null;

  const measured = new Date(results.generatedAt);
  const measuredLabel = Number.isNaN(measured.valueOf())
    ? null
    : measured.toISOString().slice(0, 10);

  return (
    <a
      href="https://github.com/iconbaypark2900/satellite-tracker/blob/main/docs/VALIDATION.md"
      target="_blank"
      rel="noopener noreferrer"
      className="group shrink-0 border-t border-space-border px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
      title={
        `Median angular error vs JPL Horizons over ${results.windowHours}h, ` +
        `${samples} samples above 10° elevation. Click for the method.`
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary">
          Validated
        </span>
        {measuredLabel && (
          <span className="font-mono text-2xs text-text-tertiary">
            {measuredLabel}
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-mono text-sm font-semibold text-text-primary">
          {formatDegrees(median)}°
        </span>
        <span className="text-2xs text-text-secondary group-hover:text-text-primary">
          median vs JPL Horizons
        </span>
      </div>
    </a>
  );
}
