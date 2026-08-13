/**
 * PcCell — probability of collision, shown with the thing that determines
 * whether it means anything.
 *
 * A bare Pc column would be actively misleading here, and measurably so. The
 * probability comes from an ASSUMED position uncertainty that grows with TLE
 * age, and once that uncertainty is much larger than the miss distance the
 * number stops depending on the geometry at all. Measured on this app's own
 * model, with a 10 m combined hard body:
 *
 *     miss      sigma = 1.5 km      sigma = 75 km
 *     0.5 km    2.10e-5             8.89e-9
 *      10 km    4.96e-15            8.89e-9
 *
 * At 1.5 km of uncertainty the probability spans ten orders of magnitude
 * across those misses. At 75 km — which is what a three-day-old TLE gives —
 * it is the same value to three significant figures whether the objects pass
 * within half a kilometre or ten. Sorting or reacting to that column would be
 * reading noise.
 *
 * So this cell shows sigma next to Pc, and says plainly when the ratio has
 * made Pc uninformative. That is the honest presentation of a real quantity
 * computed from an admitted guess.
 */

const UNINFORMATIVE_RATIO = 3;

export default function PcCell({
  pc,
  sigmaKm,
  missKm,
}: {
  pc?: number;
  sigmaKm?: number;
  missKm: number;
}) {
  if (pc === undefined || sigmaKm === undefined) {
    // Absent, not zero. A zero would read as "safe"; the truth is "not known".
    return (
      <td className="py-1.5 pr-2 font-mono text-text-muted" title="Not computed">
        —
      </td>
    );
  }

  const diluted = sigmaKm > UNINFORMATIVE_RATIO * Math.max(missKm, 1e-6);

  return (
    <td
      className="py-1.5 pr-2 font-mono"
      style={{ color: diluted ? "#77778c" : pc > 1e-5 ? "#ff80ab" : "#e0e0ff" }}
      title={
        diluted
          ? `Assumed 1-sigma uncertainty is ${sigmaKm.toFixed(0)} km against a ` +
            `${missKm.toFixed(2)} km miss. At that ratio the probability is set by ` +
            `the uncertainty rather than by the geometry — it barely changes with ` +
            `miss distance, so do not rank encounters by it. Refresh the TLEs to ` +
            `make this column informative.`
          : `Assumed 1-sigma uncertainty ${sigmaKm.toFixed(1)} km, combined ` +
            `hard-body radius 10 m. Derived from an assumed covariance, not a ` +
            `measured one — indicative only.`
      }
    >
      {pc.toExponential(1)}
      {diluted && <span className="ml-1 text-[0.9em]">≈σ</span>}
    </td>
  );
}
