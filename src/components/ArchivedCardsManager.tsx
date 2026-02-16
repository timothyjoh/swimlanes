import { useEffect, useState } from "react";

interface ArchivedCard {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  column_name: string;
}

interface Props {
  boardId: number;
}

export default function ArchivedCardsManager({ boardId }: Props) {
  const [cards, setCards] = useState<ArchivedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchArchivedCards = async () => {
    try {
      const res = await fetch(`/api/cards/archived?boardId=${boardId}`);
      if (!res.ok) throw new Error("Failed to load archived cards");
      const data = await res.json();
      setCards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedCards();
  }, [boardId]);

  const handleRestore = async (id: number) => {
    if (restoringId) return;
    setRestoringId(id);
    setError(null);

    try {
      const res = await fetch(`/api/cards/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore card");
      }
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore card");
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (id: number, title: string) => {
    if (deletingId) return;
    const confirmed = confirm(`Permanently delete "${title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/cards/${id}/permanent`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete card");
      }
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading archived cards...</div>;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="text-gray-600 text-center py-8">
          No archived cards. Cards you archive will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {cards.length} archived {cards.length === 1 ? "card" : "cards"}
          </div>
          {cards.map((card) => (
            <div key={card.id} className="border border-gray-300 rounded p-4 bg-white">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{card.title}</h3>
                    {card.color && (
                      <span
                        className="inline-block w-4 h-4 rounded"
                        style={{ backgroundColor: card.color }}
                        aria-label={`Color: ${card.color}`}
                      />
                    )}
                  </div>
                  {card.description && (
                    <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Originally in: <strong>{card.column_name}</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    Archived: {new Date(card.archived_at!).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestore(card.id)}
                    disabled={restoringId === card.id || deletingId === card.id}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                    aria-label={`Restore card ${card.title}`}
                  >
                    {restoringId === card.id ? "..." : "Restore"}
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(card.id, card.title)}
                    disabled={restoringId === card.id || deletingId === card.id}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
                    aria-label={`Permanently delete card ${card.title}`}
                  >
                    {deletingId === card.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
