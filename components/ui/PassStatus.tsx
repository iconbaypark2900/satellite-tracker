/**
 * PassStatus.tsx — Illumination state of a single pass, as icon + label.
 *
 * The pass card and the ground-station table each had their own copy of this
 * mapping, written with different emoji for the same states ("🌤️ Sunlit"
 * against "🌤️ Sunlit (sky too bright)"), and the table was missing the
 * penumbra case entirely. One component means the two cannot drift again.
 *
 * Sun and moon carry the whole scale: lit by the sun (watchable, or washed
 * out by daylight) versus in Earth's shadow (partially, or fully). The emoji
 * this replaces used four unrelated weather pictograms, which read as four
 * unrelated things rather than as one axis.
 */

import { PassPrediction } from "@/types";
import Icon, { IconName } from "@/components/ui/Icon";

interface Props {
  pass: PassPrediction;
  /** Drop the parenthetical qualifiers where space is tight (table cells). */
  terse?: boolean;
}

export function passStatus(
  pass: PassPrediction,
  terse = false
): { icon: IconName; text: string } {
  if (pass.neverSets) return { icon: "satellite", text: "Continuous" };

  const isVisible = pass.isVisible ?? pass.isLit;
  if (isVisible) return { icon: "sun", text: "Visible" };

  if (pass.isLit) {
    return { icon: "sun", text: terse ? "Sunlit" : "Sunlit (sky too bright)" };
  }

  // The conical shadow model distinguishes penumbra from umbra, so a pass
  // that is merely dimming does not read the same as one in full shadow.
  if (pass.illumination === "penumbra") {
    return {
      icon: "moon",
      text: terse ? "Entering shadow" : "Entering shadow (partial)",
    };
  }

  return { icon: "moon", text: terse ? "Shadow" : "In shadow" };
}

export default function PassStatus({ pass, terse = false }: Props) {
  const { icon, text } = passStatus(pass, terse);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
      <Icon name={icon} />
      {text}
    </span>
  );
}
