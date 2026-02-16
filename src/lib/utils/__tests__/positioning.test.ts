import { describe, it, expect } from "vitest";
import {
  calculateInitialPosition,
  calculateReorderPosition,
  POSITION_GAP,
} from "../positioning";

describe("calculateInitialPosition", () => {
  it("returns 1000 for empty list", () => {
    expect(calculateInitialPosition([])).toBe(1000);
  });

  it("returns 2000 for single item at position 1000", () => {
    expect(calculateInitialPosition([{ id: 1, position: 1000 }])).toBe(2000);
  });

  it("returns max+1000 for multiple items", () => {
    const items = [
      { id: 1, position: 1000 },
      { id: 2, position: 2000 },
      { id: 3, position: 3000 },
    ];
    expect(calculateInitialPosition(items)).toBe(4000);
  });

  it("handles non-sequential positions", () => {
    const items = [
      { id: 1, position: 500 },
      { id: 2, position: 5000 },
    ];
    expect(calculateInitialPosition(items)).toBe(6000);
  });
});

describe("calculateReorderPosition", () => {
  it("returns POSITION_GAP for single-item list", () => {
    const items = [{ id: 1, position: 1000 }];
    expect(calculateReorderPosition(items, items[0], 0)).toBe(POSITION_GAP);
  });

  it("calculates position when moving to first position", () => {
    const items = [
      { id: 1, position: 1000 },
      { id: 2, position: 2000 },
      { id: 3, position: 3000 },
    ];
    const result = calculateReorderPosition(items, items[2], 0);
    expect(result).toBe(0); // max(0, 1000 - 1000) = 0
  });

  it("calculates position when moving to last position", () => {
    const items = [
      { id: 1, position: 1000 },
      { id: 2, position: 2000 },
      { id: 3, position: 3000 },
    ];
    const result = calculateReorderPosition(items, items[0], 2);
    expect(result).toBe(4000); // 3000 + 1000
  });

  it("calculates midpoint when moving between two items", () => {
    const items = [
      { id: 1, position: 1000 },
      { id: 2, position: 2000 },
      { id: 3, position: 3000 },
    ];
    const result = calculateReorderPosition(items, items[2], 1);
    expect(result).toBe(1500); // floor((1000 + 2000) / 2)
  });

  it("floors midpoint for odd sums", () => {
    const items = [
      { id: 1, position: 1000 },
      { id: 2, position: 2001 },
      { id: 3, position: 3000 },
    ];
    const result = calculateReorderPosition(items, items[2], 1);
    expect(result).toBe(1500); // floor((1000 + 2001) / 2) = floor(1500.5) = 1500
  });

  it("handles positions close together", () => {
    const items = [
      { id: 1, position: 100 },
      { id: 2, position: 101 },
      { id: 3, position: 200 },
    ];
    const result = calculateReorderPosition(items, items[2], 1);
    expect(result).toBe(100); // floor((100 + 101) / 2) = 100
  });

  it("clamps to 0 when moving to first with low position", () => {
    const items = [
      { id: 1, position: 500 },
      { id: 2, position: 1000 },
    ];
    const result = calculateReorderPosition(items, items[1], 0);
    expect(result).toBe(0); // max(0, 500 - 1000) = 0
  });
});
