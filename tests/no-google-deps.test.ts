import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

function read(p: string): string {
  return fs.readFileSync(path.join(root, p), "utf-8");
}

describe("no-Google dependency guard", () => {
  it("package.json has no Google AI / Firebase / reCAPTCHA deps", () => {
    const pkg = JSON.parse(read("package.json"));
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of Object.keys(all)) {
      expect(name).not.toMatch(/google|genai|firebase|recaptcha/i);
    }
  });

  it("vite config + env example contain no live Google backend references", () => {
    // Strip comment lines first: comments may document the *removal* of
    // Google deps ("No Google Cloud Run / Firebase ..."), which must not
    // trip the guard. Only live code/imports/env keys count.
    for (const f of ["vite.config.ts", ".env.example", "index.html"]) {
      const text = read(f)
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("#"))
        .join("\n");
      expect(text).not.toMatch(/@google\/genai|GoogleGenAI|GEMINI_API_KEY|reCAPTCHA/i);
    }
  });

  it("frontend never imports the legacy express simulator as a data source", () => {
    const app = read("src/App.tsx");
    expect(app).not.toMatch(/from ["']\.\.\/server/);
  });
});
