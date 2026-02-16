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
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/boards")
      .then((res) => res.json())
      .then((data: Board[]) => setBoards(data))
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

    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });

    if (res.ok) {
      const board: Board = await res.json();
      setBoards((prev) => [board, ...prev]);
      setNewName("");
    }
  }

  async function handleRename(id: number) {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }

    const res = await fetch(`/api/boards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });

    if (res.ok) {
      const updated: Board = await res.json();
      setBoards((prev) => prev.map((b) => (b.id === id ? updated : b)));
    }
    setEditingId(null);
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this board?")) return;

    const res = await fetch(`/api/boards/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBoards((prev) => prev.filter((b) => b.id !== id));
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
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create Board
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
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-sm font-medium text-gray-900">
                  {board.name}
                </span>
              )}
              <div className="ml-4 flex gap-2">
                <button
                  onClick={() => startEditing(board)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(board.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
