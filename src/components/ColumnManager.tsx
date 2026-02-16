import { useState, useEffect, useRef } from "react";

interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface ColumnManagerProps {
  boardId: number;
}

export default function ColumnManager({ boardId }: ColumnManagerProps) {
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
  const editInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-focus edit input
  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(e: React.DragEvent, targetColumn: Column) {
    e.preventDefault();

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder column");
    } finally {
      setDraggedId(null);
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading columns...</div>;
  }

  return (
    <div>
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
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column)}
              className={`flex-shrink-0 w-72 bg-gray-100 rounded p-4 cursor-move ${
                draggedId === column.id ? "opacity-50" : ""
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
