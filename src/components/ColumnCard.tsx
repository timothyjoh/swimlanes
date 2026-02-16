import { useState } from 'react';
import type { Column } from '@/lib/db/types';

interface ColumnCardProps {
  column: Column;
  onColumnUpdated: (column: Column) => void;
  onColumnDeleted: (columnId: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function ColumnCard({
  column,
  onColumnUpdated,
  onColumnDeleted,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: ColumnCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editName.trim()) {
      setError('Column name is required');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/columns/${column.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update column');
      }

      const updated = await response.json();
      onColumnUpdated(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditName(column.name);
    setIsEditing(false);
    setError(null);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${column.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/columns/${column.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete column');
      }

      onColumnDeleted(column.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUpdating}
            autoFocus
          />
        ) : (
          <h2 className="text-lg font-semibold text-gray-900">{column.name}</h2>
        )}

        <div className="flex gap-1 ml-2">
          {!isEditing && (
            <div className="flex flex-col">
              <button
                onClick={onMoveUp}
                disabled={!canMoveUp || isDeleting}
                className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                title="Move left"
              >
                ←
              </button>
              <button
                onClick={onMoveDown}
                disabled={!canMoveDown || isDeleting}
                className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                title="Move right"
              >
                →
              </button>
            </div>
          )}

          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className="px-2 py-1 text-sm text-green-600 hover:text-green-800 disabled:text-gray-400"
                title="Save"
              >
                ✓
              </button>
              <button
                onClick={handleCancel}
                disabled={isUpdating}
                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400"
                title="Cancel"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-2 py-1 text-sm text-blue-600 hover:text-blue-800"
                title="Rename"
              >
                ✎
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-2 py-1 text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                title="Delete"
              >
                🗑
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-2">{error}</p>
      )}

      <div className="text-sm text-gray-400 italic">
        Cards will appear here (Phase 3)
      </div>
    </div>
  );
}
