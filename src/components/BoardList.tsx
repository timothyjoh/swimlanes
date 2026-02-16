import { useState, useEffect, useRef } from "react";

interface Board {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function BoardList() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/boards")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load boards");
        return res.json();
      })
      .then((data: Board[]) => setBoards(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newName.trim()) return;

    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create board");
      }

      const board: Board = await res.json();
      setBoards((prev) => [board, ...prev]);
      setNewName("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create board");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: number) {
    if (!editName.trim()) {
      const original = boards.find((b) => b.id === id);
      if (original) {
        setEditName(original.name);
      }
      setEditingId(null);
      return;
    }

    setError(null);
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/boards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to rename board");
      }

      const updated: Board = await res.json();
      setBoards((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename board");
    } finally {
      setUpdatingId(null);
      setEditingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this board?")) return;

    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/boards/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete board");
      }
      setBoards((prev) => prev.filter((b) => b.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete board");
    } finally {
      setDeletingId(null);
    }
  }

  function startEditing(board: Board) {
    setEditingId(board.id);
    setEditName(board.name);
  }

  if (loading) {
    return <p className="text-gray-500">Loading boards...</p>;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New board name"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? "Creating..." : "Create Board"}
        </button>
      </form>

      {boards.length === 0 ? (
        <p className="text-gray-500">No boards yet. Create one above!</p>
      ) : (
        <ul className="space-y-2">
          {boards.map((board) => (
            <li
              key={board.id}
              className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
            >
              {editingId === board.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(board.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => handleRename(board.id)}
                  disabled={updatingId === board.id}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <a
                  href={`/boards/${board.id}`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  {board.name}
                </a>
              )}
              <div className="ml-4 flex gap-2">
                <button
                  onClick={() => startEditing(board)}
                  disabled={updatingId === board.id || deletingId === board.id}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingId === board.id ? "Saving..." : "Edit"}
                </button>
                <button
                  onClick={() => handleDelete(board.id)}
                  disabled={deletingId === board.id || updatingId === board.id}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === board.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
