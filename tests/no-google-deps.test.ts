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

  it("vite config + env example are Google-free", () => {
    for (const f of ["vite.config.ts", ".env.example", "index.html"]) {
      const text = read(f);
      expect(text).not.toMatch(/@google\/genai|GoogleGenAI|GEMINI_API_KEY|reCAPTCHA|firebase/i);
    }
  });

  it("frontend never imports the legacy express simulator as a data source", () => {
    const app = read("src/App.tsx");
    expect(app).not.toMatch(/from ["']\.\.\/server/);
  });
});
