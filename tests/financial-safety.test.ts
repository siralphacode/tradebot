import { describe, expect, it } from "vitest";
import { FINANCIAL_OPERATIONS_ENABLED } from "../src/tradenews/config.ts";

describe("financial safety gates", () => {
  it("FINANCIAL_OPERATIONS_ENABLED defaults to false", () => {
    expect(FINANCIAL_OPERATIONS_ENABLED).toBe(false);
  });
});
