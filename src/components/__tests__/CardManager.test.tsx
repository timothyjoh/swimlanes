// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import CardManager from "../CardManager";

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("CardManager", () => {
  it("renders without crashing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<CardManager columnId={1} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Add a card...")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    );

    render(<CardManager columnId={1} />);
    expect(screen.getByText("Loading cards...")).toBeInTheDocument();
  });

  it("shows error banner when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Database error" }),
    });

    render(<CardManager columnId={1} />);

    await waitFor(() => {
      expect(screen.getByText("Database error")).toBeInTheDocument();
    });
  });

  it("renders cards after fetch succeeds", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          column_id: 1,
          title: "Task 1",
          description: "Description",
          color: "blue",
          position: 1000,
          created_at: "",
          updated_at: "",
        },
        {
          id: 2,
          column_id: 1,
          title: "Task 2",
          description: null,
          color: null,
          position: 2000,
          created_at: "",
          updated_at: "",
        },
      ],
    });

    render(<CardManager columnId={1} />);

    await waitFor(() => {
      expect(screen.getByText("Task 1")).toBeInTheDocument();
      expect(screen.getByText("Task 2")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("blue")).toBeInTheDocument();
    });
  });

  it("shows 'No cards yet' when column is empty", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<CardManager columnId={1} />);

    await waitFor(() => {
      expect(screen.getByText("No cards yet")).toBeInTheDocument();
    });
  });

  it("shows 'Creating...' during card creation", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<CardManager columnId={1} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Add a card...")).toBeInTheDocument();
    });

    // Type a card title
    fireEvent.change(screen.getByPlaceholderText("Add a card..."), {
      target: { value: "New Task" },
    });

    // Mock create that never resolves
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise(() => {})
    );

    // Submit form
    fireEvent.click(screen.getByText("Add Card"));

    await waitFor(() => {
      expect(screen.getByText("Creating...")).toBeInTheDocument();
    });
  });

  it("adds card to list after successful creation", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<CardManager columnId={1} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Add a card...")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Add a card..."), {
      target: { value: "New Task" },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 1,
        column_id: 1,
        title: "New Task",
        description: null,
        color: null,
        position: 1000,
        created_at: "",
        updated_at: "",
      }),
    });

    fireEvent.click(screen.getByText("Add Card"));

    await waitFor(() => {
      expect(screen.getByText("New Task")).toBeInTheDocument();
    });
  });

  it("enters edit mode when card title is clicked", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          column_id: 1,
          title: "Task 1",
          description: null,
          color: null,
          position: 1000,
          created_at: "",
          updated_at: "",
        },
      ],
    });

    render(<CardManager columnId={1} />);

    await waitFor(() => {
      expect(screen.getByText("Task 1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Task 1"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Task 1")).toBeInTheDocument();
      expect(screen.getByText("Save")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });
});
