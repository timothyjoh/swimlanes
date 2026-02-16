import { useState, useEffect } from "react";
import {
  calculateReorderPosition,
  type PositionedItem,
} from "../lib/utils/positioning";

interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

interface CardManagerProps {
  columnId: number;
  onCardDrop?: (cardId: number, sourceColumnId: number, targetColumnId: number) => void;
}

const CARD_COLORS = ["red", "blue", "green", "yellow", "purple", "gray"] as const;

const COLOR_CLASSES: Record<(typeof CARD_COLORS)[number], string> = {
  red: "bg-red-200 text-red-900",
  blue: "bg-blue-200 text-blue-900",
  green: "bg-green-200 text-green-900",
  yellow: "bg-yellow-200 text-yellow-900",
  purple: "bg-purple-200 text-purple-900",
  gray: "bg-gray-200 text-gray-900",
};

export default function CardManager({
  columnId,
  onCardDrop,
}: CardManagerProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  // Fetch cards on mount
  useEffect(() => {
    async function fetchCards() {
      try {
        const res = await fetch(`/api/cards?columnId=${columnId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load cards");
        }
        const data = await res.json();
        setCards(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cards");
      } finally {
        setLoading(false);
      }
    }
    fetchCards();
  }, [columnId]);

  // Create card
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId, title: newTitle }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create card");
      }

      const card = await res.json();
      setCards([...cards, card]);
      setNewTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create card");
    } finally {
      setCreating(false);
    }
  }

  // Enter edit mode
  function startEdit(card: Card) {
    setEditingId(card.id);
    setEditTitle(card.title);
    setEditDescription(card.description || "");
    setEditColor(card.color);
  }

  // Cancel edit mode
  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditColor(null);
  }

  // Save edit
  async function handleUpdate(id: number) {
    if (!editTitle.trim() || updatingId) return;

    setUpdatingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
          color: editColor,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update card");
      }

      const updatedCard = await res.json();
      setCards(cards.map((c) => (c.id === id ? updatedCard : c)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update card");
    } finally {
      setUpdatingId(null);
    }
  }

  // Delete card
  async function handleDelete(id: number) {
    if (!confirm("Delete this card?")) return;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });

      if (!res.ok && res.status !== 204) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete card");
      }

      setCards(cards.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card");
    } finally {
      setDeletingId(null);
    }
  }

  // Drag handlers
  function handleDragStart(e: React.DragEvent, card: Card) {
    if (editingId === card.id) {
      e.preventDefault();
      return;
    }
    setDraggedId(card.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({
      cardId: card.id,
      sourceColumnId: columnId,
    }));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(e: React.DragEvent, targetCard: Card) {
    e.preventDefault();
    e.stopPropagation();

    let dragData: { cardId: number; sourceColumnId: number } | null = null;
    try {
      dragData = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      setDraggedId(null);
      return;
    }

    if (!dragData || dragData.cardId === targetCard.id) {
      setDraggedId(null);
      return;
    }

    // Cross-column drop
    if (dragData.sourceColumnId !== columnId) {
      if (onCardDrop) {
        onCardDrop(dragData.cardId, dragData.sourceColumnId, columnId);
      }
      setDraggedId(null);
      return;
    }

    // Same-column reorder
    const draggedCard = cards.find((c) => c.id === dragData!.cardId);
    if (!draggedCard) {
      setDraggedId(null);
      return;
    }

    const targetIndex = cards.findIndex((c) => c.id === targetCard.id);
    const newPosition = calculateReorderPosition(
      cards as PositionedItem[],
      draggedCard as PositionedItem,
      targetIndex
    );

    setError(null);

    try {
      const res = await fetch(`/api/cards/${dragData.cardId}/position`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: newPosition }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reorder card");
      }

      const updatedCard = await res.json();
      const newCards = cards.map((c) =>
        c.id === dragData!.cardId ? updatedCard : c
      );
      newCards.sort((a, b) => a.position - b.position);
      setCards(newCards);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder card");
    } finally {
      setDraggedId(null);
    }
  }

  // Drop on empty area of column (for cross-column drops)
  function handleDropOnColumn(e: React.DragEvent) {
    e.preventDefault();

    let dragData: { cardId: number; sourceColumnId: number } | null = null;
    try {
      dragData = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      setDraggedId(null);
      return;
    }

    if (!dragData) {
      setDraggedId(null);
      return;
    }

    if (dragData.sourceColumnId !== columnId && onCardDrop) {
      onCardDrop(dragData.cardId, dragData.sourceColumnId, columnId);
    }
    setDraggedId(null);
  }

  if (loading) {
    return (
      <div className="p-2 text-sm text-gray-600">Loading cards...</div>
    );
  }

  return (
    <div
      className="space-y-2 min-h-[50px]"
      onDragOver={handleDragOver}
      onDrop={handleDropOnColumn}
    >
      {error && (
        <div className="p-2 bg-red-100 text-red-900 rounded text-sm">
          {error}
        </div>
      )}

      {cards.length === 0 && !error && (
        <div className="p-2 text-sm text-gray-500">No cards yet</div>
      )}

      {cards.map((card) => (
        <div
          key={card.id}
          draggable={editingId !== card.id}
          onDragStart={(e) => handleDragStart(e, card)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, card)}
          className={`p-3 bg-white rounded shadow-sm border border-gray-200 ${
            editingId !== card.id ? "cursor-move" : ""
          } ${draggedId === card.id ? "opacity-50" : ""}`}
        >
          {editingId === card.id ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={updatingId === card.id}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                autoFocus
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                disabled={updatingId === card.id}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none"
                rows={3}
              />
              <select
                value={editColor || ""}
                onChange={(e) => setEditColor(e.target.value || null)}
                disabled={updatingId === card.id}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">No color</option>
                {CARD_COLORS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdate(card.id)}
                  disabled={updatingId === card.id || !editTitle.trim()}
                  className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatingId === card.id ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={updatingId === card.id}
                  className="flex-1 px-2 py-1 bg-gray-300 text-gray-900 rounded text-xs hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start">
                <div
                  onClick={() => startEdit(card)}
                  className="flex-1 font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                >
                  {card.title}
                </div>
                <button
                  onClick={() => handleDelete(card.id)}
                  disabled={deletingId === card.id}
                  className="ml-2 text-red-600 hover:text-red-800 text-xs disabled:opacity-50"
                >
                  {deletingId === card.id ? "..." : "Delete"}
                </button>
              </div>
              {card.description && (
                <div className="mt-1 text-sm text-gray-600">
                  {card.description}
                </div>
              )}
              {card.color && (
                <div className="mt-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      COLOR_CLASSES[
                        card.color as (typeof CARD_COLORS)[number]
                      ] || COLOR_CLASSES.gray
                    }`}
                  >
                    {card.color}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {/* Create form */}
      <form onSubmit={handleCreate} className="space-y-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a card..."
          disabled={creating}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? "Creating..." : "Add Card"}
        </button>
      </form>
    </div>
  );
}
