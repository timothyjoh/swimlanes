// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function mockFetchForSearch() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes("/api/columns")) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: 1, board_id: 1, name: "Todo", position: 1000, created_at: "", updated_at: "" },
        ],
      });
    }
    if (url.includes("/api/cards")) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: 1, column_id: 1, title: "Test Card", description: "Test description", color: "red", position: 1000, created_at: "", updated_at: "" },
          { id: 2, column_id: 1, title: "Another Card", description: null, color: "blue", position: 2000, created_at: "", updated_at: "" },
        ],
      });
    }
    return Promise.reject(new Error("Unknown URL"));
  });
}

describe("ColumnManager search functionality", () => {
  it("renders search input", async () => {
    mockFetchForSearch();
    render(<ColumnManager boardId={1} />);
    expect(await screen.findByLabelText("Search cards")).toBeInTheDocument();
  });

  it("shows clear button when query is non-empty", async () => {
    mockFetchForSearch();
    const user = userEvent.setup();
    render(<ColumnManager boardId={1} />);

    const searchInput = await screen.findByLabelText("Search cards");
    await user.type(searchInput, "test");

    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", async () => {
    mockFetchForSearch();
    const user = userEvent.setup();
    render(<ColumnManager boardId={1} />);

    const searchInput = await screen.findByLabelText("Search cards");
    await user.type(searchInput, "test");

    const clearButton = screen.getByLabelText("Clear search");
    await user.click(clearButton);

    expect(searchInput).toHaveValue("");
  });

  it("clears search when Escape is pressed", async () => {
    mockFetchForSearch();
    const user = userEvent.setup();
    render(<ColumnManager boardId={1} />);

    const searchInput = await screen.findByLabelText("Search cards");
    await user.type(searchInput, "test");
    await user.keyboard("{Escape}");

    expect(searchInput).toHaveValue("");
  });

  it("initializes search query from prop", async () => {
    mockFetchForSearch();
    render(<ColumnManager boardId={1} initialSearchQuery="test" />);

    const searchInput = await screen.findByLabelText("Search cards");
    expect(searchInput).toHaveValue("test");
  });

  it("shows match count after debounce", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchForSearch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ColumnManager boardId={1} />);

    const searchInput = await screen.findByLabelText("Search cards");
    await user.type(searchInput, "test");

    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByText(/cards? found/)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it("updates URL when search query changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchForSearch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    render(<ColumnManager boardId={1} />);

    const searchInput = await screen.findByLabelText("Search cards");
    await user.type(searchInput, "test");

    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        "",
        expect.stringContaining("q=test")
      );
    });

    vi.useRealTimers();
  });
});
