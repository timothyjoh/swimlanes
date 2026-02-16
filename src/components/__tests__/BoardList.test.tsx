// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import BoardList from "../BoardList";

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe("BoardList", () => {
  beforeEach(() => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it("renders without crashing", async () => {
    render(<BoardList />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("New board name")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    // Make fetch hang so loading state persists
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<BoardList />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows empty state when no boards", async () => {
    render(<BoardList />);
    await waitFor(() => {
      expect(screen.getByText(/no boards yet/i)).toBeInTheDocument();
    });
  });
});
