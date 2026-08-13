/**
 * AccuracyBadge — the number must come from the evidence, not from a literal.
 *
 * The badge advertises this tracker's validation against JPL Horizons. The
 * failure it must not have is a hard-coded figure: a claim that keeps rendering
 * confidently after the measurement behind it changes, or is deleted. That is
 * the same defect this project's research-integrity work exists to prevent,
 * applied to its own marketing.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.join(process.cwd(), "components/ui/AccuracyBadge.tsx"),
  "utf8"
);
const RESULTS = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "docs/validation-results.json"), "utf8")
);

/**
 * Source with comments stripped — a literal in prose is not a literal in code.
 *
 * The line-comment pattern is guarded with (?<!:) because a naive /\/\/.*$/
 * eats the "https://" in the methodology link, which then looks like a missing
 * link rather than a broken test. It did exactly that on the first run.
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

describe("AccuracyBadge", () => {
  it("reads the figure from validation-results.json", () => {
    expect(CODE).toContain('from "@/docs/validation-results.json"');
    expect(CODE).toContain("angularErrorDeg");
  });

  it("hard-codes no accuracy figure in the rendered output", () => {
    // Test the actual risk — a literal standing in for the MEASUREMENT —
    // rather than every decimal in the file. A first draft banned all decimals
    // and flagged the 0.01 formatting threshold, which is not a claim about
    // accuracy and has to stay.
    const median = RESULTS.angularErrorDeg.above10El.median;
    for (const dp of [2, 3, 4]) {
      expect(CODE).not.toContain(median.toFixed(dp));
    }
  });

  it("renders nothing rather than something wrong if the shape changes", () => {
    expect(CODE).toMatch(/return null/);
    expect(CODE).toMatch(/Number\.isFinite/);
  });

  it("uses the above-10-degree median, which is the honest figure", () => {
    // All-sky median (0.005°) is the flattering number; the one that matters is
    // during the overhead passes a user would actually try to see.
    expect(CODE).toContain("above10El");
    expect(RESULTS.angularErrorDeg.above10El.median).toBeGreaterThan(
      RESULTS.angularErrorDeg.allSky.median
    );
  });

  it("never rounds a small error away to zero", () => {
    // A 0.004° result formatted to 2dp reads "0.00°", which claims perfection.
    expect(CODE).toMatch(/toFixed\(4\)/);
  });

  it("links to the methodology rather than asserting the number alone", () => {
    expect(CODE).toContain("VALIDATION.md");
  });

  it("the evidence file carries what the badge needs", () => {
    expect(typeof RESULTS.angularErrorDeg.above10El.median).toBe("number");
    expect(typeof RESULTS.generatedAt).toBe("string");
    expect(RESULTS.angularErrorDeg.above10El.n).toBeGreaterThan(0);
  });
});
