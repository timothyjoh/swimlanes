import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import CardManager from "./CardManager";

interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
}

interface ColumnManagerProps {
  boardId: number;
  initialSearchQuery?: string;
}

export default function ColumnManager({ boardId, initialSearchQuery = "" }: ColumnManagerProps) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [cardRefreshKey, setCardRefreshKey] = useState(0);
  const [focusedColumnId, setFocusedColumnId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [announceText, setAnnounceText] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialSearchQuery);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [archivedCount, setArchivedCount] = useState<number>(0);
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch columns on mount
  useEffect(() => {
    async function fetchColumns() {
      try {
        const res = await fetch(`/api/columns?boardId=${boardId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load columns");
        }
        const data = await res.json();
        setColumns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load columns");
      } finally {
        setLoading(false);
      }
    }
    fetchColumns();
  }, [boardId]);

  const refreshArchivedCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/cards/archived?boardId=${boardId}`);
      if (res.ok) {
        const cards = await res.json();
        setArchivedCount(cards.length);
      }
    } catch (err) {
      console.error("Failed to fetch archived count:", err);
    }
  }, [boardId]);

  useEffect(() => {
    refreshArchivedCount();
  }, [refreshArchivedCount]);

  // Auto-focus edit input
  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync search query to URL query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedQuery.trim()) {
      params.set("q", debouncedQuery.trim());
    } else {
      params.delete("q");
    }
    const paramString = params.toString();
    const newUrl = paramString
      ? `${window.location.pathname}?${paramString}`
      : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [debouncedQuery]);

  // Ctrl+F / Cmd+F focuses search input
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Fetch all cards for match counting when search is active
  useEffect(() => {
    async function fetchAllCards() {
      if (!debouncedQuery.trim()) {
        setAllCards([]);
        return;
      }

      try {
        const allCardsPromises = columns.map(col =>
          fetch(`/api/cards?columnId=${col.id}`).then(r => r.json())
        );
        const results = await Promise.all(allCardsPromises);
        setAllCards(results.flat());
      } catch (err) {
        console.error("Failed to fetch cards for search:", err);
      }
    }
    fetchAllCards();
  }, [columns, debouncedQuery]);

  // Calculate match count
  const matchCount = useMemo(() => {
    if (!debouncedQuery.trim()) return 0;
    const trimmed = debouncedQuery.trim().toLowerCase();
    return allCards.filter(card => {
      const titleMatch = card.title.toLowerCase().includes(trimmed);
      const descMatch = card.description?.toLowerCase().includes(trimmed) ?? false;
      const colorMatch = card.color?.toLowerCase().includes(trimmed) ?? false;
      return titleMatch || descMatch || colorMatch;
    }).length;
  }, [allCards, debouncedQuery]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchQuery(e.target.value);
  }

  function handleClearSearch() {
    setSearchQuery("");
    searchInputRef.current?.focus();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      handleClearSearch();
    }
  }

  // Create new column
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    setError(null);
    setCreating(true);

    try {
      const res = await fetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, name: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create column");
      }

      const newColumn = await res.json();
      setColumns([...columns, newColumn]);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create column");
    } finally {
      setCreating(false);
    }
  }

  // Start editing
  function startEdit(column: Column) {
    setEditingId(column.id);
    setEditName(column.name);
  }

  // Save rename
  async function handleRename(column: Column) {
    const trimmed = editName.trim();

    if (!trimmed) {
      setEditingId(null);
      setEditName("");
      return;
    }

    if (trimmed === column.name) {
      setEditingId(null);
      setEditName("");
      return;
    }

    setError(null);
    setUpdatingId(column.id);

    try {
      const res = await fetch(`/api/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to rename column");
      }

      const updated = await res.json();
      setColumns(columns.map((c) => (c.id === column.id ? updated : c)));
      setEditingId(null);
      setEditName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename column");
    } finally {
      setUpdatingId(null);
    }
  }

  // Delete column
  async function handleDelete(id: number) {
    if (!confirm("Delete this column? This cannot be undone.")) {
      return;
    }

    setError(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/columns/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete column");
      }

      setColumns(columns.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete column");
    } finally {
      setDeletingId(null);
    }
  }

  // Drag-and-drop handlers
  function handleDragStart(e: React.DragEvent, column: Column) {
    setDraggedId(column.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, column?: Column) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (column) {
      setDropTargetId(column.id);
    }
  }

  function handleDragLeave() {
    setDropTargetId(null);
  }

  async function handleDrop(e: React.DragEvent, targetColumn: Column) {
    e.preventDefault();
    setDropTargetId(null);

    if (draggedId === null || draggedId === targetColumn.id) {
      setDraggedId(null);
      return;
    }

    const draggedColumn = columns.find((c) => c.id === draggedId);
    if (!draggedColumn) {
      setDraggedId(null);
      return;
    }

    const targetIndex = columns.findIndex((c) => c.id === targetColumn.id);
    const draggedIndex = columns.findIndex((c) => c.id === draggedId);

    let newPosition: number;

    if (draggedIndex < targetIndex) {
      const nextColumn = columns[targetIndex + 1];
      if (nextColumn) {
        newPosition = Math.floor(
          (targetColumn.position + nextColumn.position) / 2
        );
      } else {
        newPosition = targetColumn.position + 1000;
      }
    } else {
      const prevColumn = columns[targetIndex - 1];
      if (prevColumn) {
        newPosition = Math.floor(
          (prevColumn.position + targetColumn.position) / 2
        );
      } else {
        newPosition = Math.max(0, targetColumn.position - 1000);
      }
    }

    setError(null);

    try {
      const res = await fetch(`/api/columns/${draggedId}/position`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: newPosition }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reorder column");
      }

      const updated = await res.json();
      const newColumns = columns.map((c) =>
        c.id === draggedId ? updated : c
      );
      newColumns.sort((a, b) => a.position - b.position);
      setColumns(newColumns);
      setAnnounceText(`Moved column '${draggedColumn.name}' to new position`);
      setTimeout(() => setAnnounceText(""), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder column");
    } finally {
      setDraggedId(null);
    }
  }

  // Handle cross-column card drop
  const handleCardDrop = useCallback(
    async (cardId: number, _sourceColumnId: number, targetColumnId: number) => {
      try {
        // Get cards in target column to calculate position
        const res = await fetch(`/api/cards?columnId=${targetColumnId}`);
        const targetCards = res.ok ? await res.json() : [];
        const position =
          targetCards.length > 0
            ? Math.max(...targetCards.map((c: { position: number }) => c.position)) + 1000
            : 1000;

        const moveRes = await fetch(`/api/cards/${cardId}/column`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnId: targetColumnId, position }),
        });

        if (!moveRes.ok) {
          const err = await moveRes.json();
          throw new Error(err.error || "Failed to move card");
        }

        // Force re-render of all CardManagers
        setCardRefreshKey((k) => k + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to move card");
      }
    },
    []
  );

  function handleColumnKeyDown(e: React.KeyboardEvent, column: Column) {
    if (editingId !== null) return;

    if (e.key === "Enter") {
      e.preventDefault();
      startEdit(column);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      handleDelete(column.id);
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading columns...</div>;
  }

  return (
    <div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announceText}
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New column name"
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={creating}
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Add Column"}
          </button>
        </div>
      </form>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search cards..."
            aria-label="Search cards"
            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {archivedCount > 0 && (
          <div className="mt-2">
            <a
              href={`/boards/${boardId}/archive`}
              className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
              aria-label={`View ${archivedCount} archived ${archivedCount === 1 ? "card" : "cards"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span>{archivedCount} archived</span>
            </a>
            <div className="sr-only" role="status" aria-live="polite">
              {archivedCount} {archivedCount === 1 ? "card" : "cards"} archived
            </div>
          </div>
        )}

        {debouncedQuery.trim() && (
          <div className="mt-2 text-sm text-gray-600">
            <span role="status" aria-live="polite">
              {matchCount} {matchCount === 1 ? "card" : "cards"} found
            </span>
          </div>
        )}
      </div>

      {columns.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No columns yet. Create your first column above.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div
              key={column.id}
              draggable={editingId !== column.id}
              onDragStart={(e) => handleDragStart(e, column)}
              onDragOver={(e) => handleDragOver(e, column)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column)}
              onKeyDown={(e) => handleColumnKeyDown(e, column)}
              onFocus={() => setFocusedColumnId(column.id)}
              onBlur={() => setFocusedColumnId(null)}
              tabIndex={0}
              aria-label={`Column: ${column.name}`}
              className={`flex-shrink-0 w-72 bg-gray-100 rounded p-4 cursor-move flex flex-col ${
                draggedId === column.id ? "opacity-50" : ""
              } ${focusedColumnId === column.id ? "ring-2 ring-blue-500" : ""} ${
                dropTargetId === column.id ? "bg-blue-50 border-blue-300" : ""
              }`}
            >
              {editingId === column.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleRename(column)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(column);
                    if (e.key === "Escape") {
                      setEditingId(null);
                      setEditName("");
                    }
                  }}
                  disabled={updatingId === column.id}
                  className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="flex items-center justify-between mb-2">
                  <h3
                    onClick={() => startEdit(column)}
                    className="font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                  >
                    {column.name}
                  </h3>
                  <button
                    onClick={() => handleDelete(column.id)}
                    disabled={deletingId === column.id}
                    className="text-red-600 hover:text-red-800 disabled:text-gray-400 text-sm"
                  >
                    {deletingId === column.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              )}
              <div className="mt-2 flex-1 overflow-y-auto">
                <CardManager
                  key={`${column.id}-${cardRefreshKey}`}
                  columnId={column.id}
                  onCardDrop={handleCardDrop}
                  searchQuery={debouncedQuery}
                  onArchive={refreshArchivedCount}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
