/**
 * CollapsibleSection.tsx — A titled sidebar section that can be folded away.
 *
 * The sidebar stacks four things in a fixed column: category filter, satellite
 * list, space weather, and the detail panel. Two of those are ambient — you
 * set the filters once and glance at space weather occasionally — but they
 * were charging full height permanently, which left the two panels you
 * actually work in fighting over what was left.
 *
 * Folding is per-section and remembered for the session, so the sidebar keeps
 * whatever shape the user arranged instead of resetting on every navigation.
 */

"use client";

import { ReactNode } from "react";
import Icon, { IconName } from "@/components/ui/Icon";

interface Props {
  title: string;
  icon: IconName;
  open: boolean;
  onToggle: () => void;
  /** Shown on the header row when collapsed — a glanceable stand-in. */
  summary?: ReactNode;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  summary,
  children,
}: Props) {
  return (
    <section className="border-b border-space-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
      >
        <Icon name={icon} />
        <span className="font-medium uppercase tracking-wider" style={{ fontSize: "0.62rem" }}>
          {title}
        </span>
        {!open && summary && (
          <span className="ml-1 truncate text-text-muted/80" style={{ fontSize: "0.62rem" }}>
            {summary}
          </span>
        )}
        <span
          className="ml-auto flex-shrink-0 transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          <Icon name="chevron" />
        </span>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </section>
  );
}
