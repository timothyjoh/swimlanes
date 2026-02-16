import { describe, it, expect } from "vitest";
import BoardList from "../BoardList";

describe("BoardList", () => {
  it("exports a function component", () => {
    expect(typeof BoardList).toBe("function");
  });
});
