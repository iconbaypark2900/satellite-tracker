/**
 * SatelliteDetail.tsx — Detail panel for the selected satellite.
 *
 * Two sections, split by how much the app can vouch for the numbers:
 *
 *   Orbit     — derived from the TLE by SGP4 on this machine. Always present,
 *               always current, no network involved.
 *   Catalogue — identity from the curated table or Celestrak's SATCAT. Often
 *               missing, and missing for several different reasons.
 *
 * The split exists because the previous flat list gave both the same weight,
 * so a "—" sitting next to a live altitude read as a gap in the data rather
 * than as a lookup that never came back. The catalogue section now states
 * which of those it is instead of rendering placeholder rows.
 */

"use client";

import { useSatelliteStore } from "@/lib/satellite-store";
import { Satellite } from "@/types";
import { orbitalVelocity, orbitType, tleEpochToDate } from "@/lib/orbit-utils";
import { GROUP_COLORS, GROUP_LABELS } from "@/lib/constants";
import { useSatCatRecord } from "@/hooks/useSatCatData";
import { missionProfile, orbitInsight } from "@/lib/mission-profiles";
import Icon from "@/components/ui/Icon";

/** SGP4 error grows roughly 1–3 km/day past epoch. */
const TLE_STALE_DAYS = 3;
const TLE_VERY_STALE_DAYS = 7;

export default function SatelliteDetail() {
  const { selectedSatellite, setSelectedSatellite } = useSatelliteStore();
  const { record, isLoading, isUnavailable } = useSatCatRecord(
    selectedSatellite?.noradId ?? null
  );

  if (!selectedSatellite) {
    return (
      <div className="dp">
        <h2 className="text-primary mb-1 text-xs font-semibold">
          Selected Satellite
        </h2>
        <p className="text-text-muted flex items-center justify-center gap-1.5 py-3 text-center text-xs">
          <Icon name="search" />
          <span>Click a satellite or its orbit path to view details</span>
        </p>
      </div>
    );
  }

  const sat = selectedSatellite;
  const color = GROUP_COLORS[sat.group] ?? GROUP_COLORS.OTHER;

  return (
    <div className="dp">
      <SatelliteHeading sat={sat} color={color} />
      <MissionSection sat={sat} />
      <OrbitSection sat={sat} />
      <CatalogueSection
        sat={sat}
        record={record}
        isLoading={isLoading}
        isUnavailable={isUnavailable}
      />
      <TleProvenance sat={sat} />

      <button
        type="button"
        className="text-text-muted text-xs mt-1.5 cursor-pointer hover:text-primary transition-colors"
        onClick={() => setSelectedSatellite(null)}
      >
        <Icon name="close" /> Clear selection
      </button>
    </div>
  );
}

/**
 * The name is the heading — the old panel spent its title on the constant
 * "Selected Satellite" and then repeated the name in the first data row.
 */
function SatelliteHeading({ sat, color }: { sat: Satellite; color: string }) {
  return (
    <div className="mb-1.5">
      <div className="flex items-baseline gap-1.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 self-center"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
        <h2 className="text-primary text-xs font-semibold truncate" title={sat.name}>
          {sat.name}
        </h2>
        <span className="text-text-muted/60 font-mono text-xs ml-auto flex-shrink-0">
          #{sat.noradId}
        </span>
      </div>
      <p className="text-text-muted text-xs ml-3.5">
        {GROUP_LABELS[sat.group] ?? "Unclassified"}
        {" · "}
        {orbitType(sat.altitude, sat.inclination)}
      </p>
    </div>
  );
}

/**
 * What the satellite is for. The heading changes with the tier so the panel
 * never implies it knows more than it does: "Mission" is a claim about this
 * object, "About this class" is a claim about the kind of object.
 */
function MissionSection({ sat }: { sat: Satellite }) {
  const mission = missionProfile(sat);
  const specific = mission.tier !== "class";

  return (
    <section className="mt-2">
      <SectionLabel>{specific ? "Mission" : "About this class"}</SectionLabel>
      <p className="text-text-primary/85 text-xs leading-relaxed py-0.5">
        {mission.purpose}
      </p>
    </section>
  );
}

/**
 * Computed locally from the TLE — no source can be missing here.
 *
 * Led by what the orbit itself means. The shape of an orbit is a design
 * decision, and saying why it was chosen turns five numbers into something
 * a reader can reason about.
 */
function OrbitSection({ sat }: { sat: Satellite }) {
  const insight = orbitInsight(sat);
  const rows: [string, string][] = [
    ["Altitude", `${Math.round(sat.altitude)} km`],
    ["Period", `${sat.period.toFixed(1)} min`],
    ["Inclination", `${sat.inclination.toFixed(2)}°`],
    ["Velocity", `${orbitalVelocity(sat.altitude).toFixed(2)} km/s`],
    // Paired: apogee and perigee are read as a range, and two rows of one
    // number each cost height the panel does not have.
    ["Apogee / perigee", `${Math.round(sat.apogee)} / ${Math.round(sat.perigee)} km`],
  ];

  return (
    <section className="mt-2">
      <SectionLabel>Orbit</SectionLabel>
      {insight && (
        <p className="text-text-muted text-xs leading-relaxed pb-1">
          {/* The regime name leads the sentence rather than joining the
              section label — uppercased in the header it reads as shouting. */}
          <span className="text-text-primary/80 font-medium">{insight.label}</span>
          {" — "}
          {insight.text}
        </p>
      )}
      {rows.map(([label, value]) => (
        <div key={label} className="dr">
          <span className="lab">{label}</span>
          <span className="val font-mono">{value}</span>
        </div>
      ))}
    </section>
  );
}

/**
 * Identity from the curated table or SATCAT. Every field here can be absent,
 * so the section renders one explanatory line rather than a column of
 * placeholders when there is nothing to show.
 */
function CatalogueSection({
  sat,
  record,
  isLoading,
  isUnavailable,
}: {
  sat: Satellite;
  record: ReturnType<typeof useSatCatRecord>["record"];
  isLoading: boolean;
  isUnavailable: boolean;
}) {
  const rows: [string, string][] = [];

  const operator = sat.operator?.name;
  if (operator) rows.push(["Operator", operator]);

  const country = record?.COUNTRY ?? sat.operator?.country;
  if (country) rows.push(["Country", country]);

  const objectType = record?.OBJECT_TYPE ?? sat.type;
  if (objectType) rows.push(["Type", objectType]);

  // A launch date and an international designator are different facts and
  // used to share a "Launch" label, so a curated date and a parsed designator
  // rendered identically.
  const launched = record?.LAUNCH ?? sat.launchDate;
  if (launched) rows.push(["Launched", launched]);
  if (sat.intlDesignator) rows.push(["Int'l designator", sat.intlDesignator]);

  return (
    <section className="mt-2">
      <SectionLabel>Catalogue</SectionLabel>
      {rows.map(([label, value]) => (
        <div key={label} className="dr">
          <span className="lab">{label}</span>
          <span className="val">{value}</span>
        </div>
      ))}
      <CatalogueStatus
        hasIdentity={Boolean(operator && country)}
        isLoading={isLoading}
        isUnavailable={isUnavailable}
      />
    </section>
  );
}

/**
 * Says why the object's identity is missing. "Lookup failed" and "no record
 * exists" look identical in the data — both yield nothing — but they mean
 * opposite things to someone deciding whether the app is broken.
 *
 * Keyed on operator and country specifically: those are the fields only the
 * catalogue can supply. Type and the designator are derived locally and are
 * present either way, so counting them would suppress the explanation
 * exactly when it is needed.
 */
function CatalogueStatus({
  hasIdentity,
  isLoading,
  isUnavailable,
}: {
  hasIdentity: boolean;
  isLoading: boolean;
  isUnavailable: boolean;
}) {
  if (hasIdentity) return null;

  const message = isUnavailable
    ? "Operator lookup unavailable — Celestrak unreachable"
    : isLoading
      ? "Looking up catalogue record…"
      : "No catalogue record for this object";

  return (
    <p
      className="text-text-muted/70 text-xs italic py-1 leading-snug"
      role={isUnavailable ? "status" : undefined}
    >
      {message}
    </p>
  );
}

/**
 * Epoch age, colour-coded: the single number that says whether to trust the
 * positions above it.
 */
function TleProvenance({ sat }: { sat: Satellite }) {
  const epochDate = sat.tle ? tleEpochToDate(sat.tle.epoch) : null;
  if (!epochDate) return null;

  const ageDays = (Date.now() - epochDate.getTime()) / 86400000;
  const color =
    ageDays > TLE_VERY_STALE_DAYS
      ? "#ff80ab"
      : ageDays > TLE_STALE_DAYS
        ? "#ffa726"
        : "#8aff8a";

  return (
    <div className="dr mt-1.5 border-t border-space-border/40 pt-1">
      <span className="lab">TLE epoch</span>
      <span className="val font-mono" style={{ color }}>
        {ageDays.toFixed(1)} d ago
      </span>
    </div>
  );
}

/**
 * Set smaller and dimmer than the data rows on purpose: at the same size it
 * reads as one more label/value row with a missing value.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-text-muted/60 uppercase tracking-[0.12em] mb-1 pb-0.5 border-b border-space-border/40"
      style={{ fontSize: "0.58rem" }}
    >
      {children}
    </h3>
  );
}
