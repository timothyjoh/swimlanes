// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ColumnManager from "../ColumnManager";

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("ColumnManager", () => {
  it("renders without crashing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ColumnManager boardId={1} />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("New column name")
      ).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    );

    render(<ColumnManager boardId={1} />);
    expect(screen.getByText("Loading columns...")).toBeInTheDocument();
  });

  it("renders columns after fetch completes", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          board_id: 1,
          name: "To Do",
          position: 1000,
          created_at: "",
          updated_at: "",
        },
        {
          id: 2,
          board_id: 1,
          name: "Done",
          position: 2000,
          created_at: "",
          updated_at: "",
        },
      ],
    });

    render(<ColumnManager boardId={1} />);

    await waitFor(() => {
      expect(screen.getByText("To Do")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  it("shows error banner when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Database error" }),
    });

    render(<ColumnManager boardId={1} />);

    await waitFor(() => {
      expect(screen.getByText("Database error")).toBeInTheDocument();
    });
  });

  it("shows empty state when no columns exist", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ColumnManager boardId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/No columns yet/i)).toBeInTheDocument();
    });
  });
});
