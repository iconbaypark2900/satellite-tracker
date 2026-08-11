import {
  xrayFluxToClass,
  kpToGScale,
  isBzSouthwardWarning,
} from "@/lib/space-weather";

describe("xrayFluxToClass", () => {
  it("classifies each flare band", () => {
    expect(xrayFluxToClass(3.06e-7)).toBe("B3.1");
    expect(xrayFluxToClass(1e-8)).toBe("A1.0");
    expect(xrayFluxToClass(5.5e-6)).toBe("C5.5");
    expect(xrayFluxToClass(2.3e-5)).toBe("M2.3");
    expect(xrayFluxToClass(1e-4)).toBe("X1.0");
  });

  it("X class is open-ended", () => {
    expect(xrayFluxToClass(2.8e-3)).toBe("X28.0");
  });

  it("handles invalid input", () => {
    expect(xrayFluxToClass(null)).toBeNull();
    expect(xrayFluxToClass(0)).toBeNull();
    expect(xrayFluxToClass(NaN)).toBeNull();
  });
});

describe("kpToGScale", () => {
  it("maps Kp to NOAA G scale", () => {
    expect(kpToGScale(4.9)).toBeNull();
    expect(kpToGScale(5)).toBe("G1");
    expect(kpToGScale(6.3)).toBe("G2");
    expect(kpToGScale(7)).toBe("G3");
    expect(kpToGScale(8.5)).toBe("G4");
    expect(kpToGScale(9)).toBe("G5");
    expect(kpToGScale(null)).toBeNull();
  });
});

describe("isBzSouthwardWarning", () => {
  it("warns only for strongly southward Bz", () => {
    expect(isBzSouthwardWarning(-5.1)).toBe(true);
    expect(isBzSouthwardWarning(-4.9)).toBe(false);
    expect(isBzSouthwardWarning(3)).toBe(false);
    expect(isBzSouthwardWarning(null)).toBe(false);
  });
});
