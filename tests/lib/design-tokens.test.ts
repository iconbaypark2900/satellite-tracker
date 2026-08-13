/**
 * Design tokens — contrast is computed, not eyeballed.
 *
 * `text-secondary` was #6f6d69: a WARM grey on a cool blue-black panel,
 * measuring 3.81:1 against the 4.5:1 WCAG AA floor for body text. It looked
 * merely "dim" and was in fact below the legibility threshold, which is the
 * kind of thing that is invisible until someone measures it.
 *
 * These tests also guard the token plumbing: colour is declared once in
 * globals.css and referenced from tailwind.config.js, and the font utilities
 * must point at the faces next/font actually loads.
 */
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const CSS = read("styles/globals.css");
const TW = read("tailwind.config.js");
const LAYOUT = read("app/layout.tsx");

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function token(name: string): string {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS);
  if (!m) throw new Error(`token --color-${name} not found in globals.css`);
  return m[1];
}

/** The panel the sidebar text actually sits on: rgba(10,10,20,0.92) over #05051a. */
const PANEL = "#0a0a14";

describe("colour tokens meet WCAG AA", () => {
  it("body text clears 4.5:1", () => {
    expect(contrast(token("text-primary"), PANEL)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("text-secondary"), PANEL)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("text-tertiary"), PANEL)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a visible step between the tiers", () => {
    // Three tiers that measure the same are one tier with extra names.
    const p = contrast(token("text-primary"), PANEL);
    const s = contrast(token("text-secondary"), PANEL);
    const t = contrast(token("text-tertiary"), PANEL);
    expect(p).toBeGreaterThan(s);
    expect(s).toBeGreaterThan(t);
  });

  it("rejects the warm grey that failed", () => {
    // Regression guard: #6f6d69 measured 3.81:1 and read muddy against the
    // cool primary. If it comes back as a VALUE, this fails.
    //
    // Checked against declarations rather than the whole file: the first draft
    // searched the raw text and tripped over the comment documenting the fix,
    // which is a test failing on its own explanation.
    const declaredValues = [...CSS.matchAll(/--color-[\w-]+:\s*([^;]+);/g)].map(
      (m) => m[1].trim().toLowerCase()
    );
    expect(declaredValues).not.toContain("#6f6d69");
    expect(contrast("#6f6d69", PANEL)).toBeLessThan(4.5);
  });

  it("gives borders enough contrast to be seen", () => {
    // Not a text requirement, but 1.26:1 was invisible.
    expect(contrast(token("space-border"), PANEL)).toBeGreaterThan(1.4);
  });
});

describe("token plumbing", () => {
  it("declares colour once and references it from Tailwind", () => {
    // Both files used to carry duplicate literals with nothing keeping them in
    // step. Tailwind should hold references, not hex.
    expect(TW).toContain("var(--color-text-secondary)");
    expect(TW).not.toMatch(/"text-secondary":\s*"#/);
    expect(TW).not.toMatch(/"space-border":\s*"#/);
  });

  it("points the font utilities at the faces next/font loads", () => {
    // `font-mono` resolved to a hardcoded "Monaco", so the Roboto Mono being
    // downloaded on every page load never rendered; Inter was mapped to
    // nothing at all. Two webfonts fetched, neither used.
    expect(TW).toContain("var(--font-inter)");
    expect(TW).toContain("var(--font-mono)");
    expect(TW).not.toContain("'Monaco'");
    expect(LAYOUT).toContain("--font-inter");
    expect(LAYOUT).toContain("--font-mono");
  });

  it("sets the body in the sans face, not monospace", () => {
    // An all-monospace interface reads as a terminal, not a product.
    expect(LAYOUT).toMatch(/<body className="font-sans/);
  });

  it("defines a type scale rather than per-component guesses", () => {
    expect(TW).toContain("fontSize:");
    expect(TW).toMatch(/lineHeight/);
  });
});

describe("tokens are declared in exactly one place", () => {
  const APP_CSS = read("app/globals.css");

  /**
   * The bug these guard against, which the tests above could not see:
   *
   * app/globals.css imported styles/globals.css and then re-declared the same
   * :root tokens AFTER the import. That block silently won. So
   * --color-text-muted stayed at #6f6d69 (3.81:1, below AA) and --font-mono
   * stayed at "Monaco" while the app downloaded Roboto Mono and Inter and
   * rendered neither — even though the tests above passed, because they read
   * the source file that was being overridden rather than the CSS the browser
   * actually receives.
   *
   * Three files defined the same tokens. Unifying two of them fixed nothing.
   */
  it("app/globals.css does not redeclare the tokens it imports", () => {
    const rootBlocks = APP_CSS.match(/:root\s*\{[\s\S]*?\}/g) ?? [];
    expect(rootBlocks).toEqual([]);
  });

  it("only one file declares the text colour tokens", () => {
    for (const file of ["app/globals.css"]) {
      expect(read(file)).not.toMatch(/--color-text-\w+:/);
    }
    expect(CSS).toMatch(/--color-text-secondary:/);
  });

  it("only one file declares the font stacks", () => {
    expect(APP_CSS).not.toMatch(/--font-(mono|sans|inter):/);
    expect(CSS).toMatch(/--font-sans:/);
  });

  it("no file hardcodes Monaco as the mono face", () => {
    // next/font loads Roboto Mono; a hardcoded Monaco means that download is
    // wasted and the UI renders in a face nobody chose.
    for (const file of ["app/globals.css", "styles/globals.css"]) {
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code).not.toContain("Monaco");
    }
  });

  it("sets the body font from the base rule, not only a utility class", () => {
    // Tailwind v4 generates utilities from @theme tokens; a plain :root
    // declaration does not register one, so `.font-sans` produces no rule.
    // The html/body base rule is what actually applies the face.
    expect(CSS).toMatch(/html,\s*body\s*\{[\s\S]*?font-family:\s*var\(--font-inter\)/);
  });
});
