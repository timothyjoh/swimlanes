import React, { useState } from 'react';
import type { Board } from '@/lib/db/types';

interface BoardFormProps {
  onBoardCreated?: (board: Board) => void;
}

export function BoardForm({ onBoardCreated }: BoardFormProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length === 0) {
      setError('Board name cannot be empty');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to create board');
        return;
      }

      const board = await response.json();
      setName('');  // Clear form

      if (onBoardCreated) {
        onBoardCreated(board);
      } else {
        // Fallback: reload page to show new board
        window.location.reload();
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error creating board:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter board name"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Creating...' : 'Create Board'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </form>
  );
}
