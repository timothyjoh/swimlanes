import { useState } from 'react';
import type { Board } from '../entities/Board';
import Button from './Button';
import CreateBoardModal from './CreateBoardModal';
import { apiCall } from '../utils/api';

interface BoardListProps {
  initialBoards: Board[];
}

export default function BoardList({ initialBoards }: BoardListProps) {
  const [boards, setBoards] = useState(initialBoards);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleCreateBoard = async (name: string) => {
    const tempId = Date.now();
    const tempBoard = {
      id: tempId,
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const previousBoards = [...boards];
    setBoards([...previousBoards, tempBoard]);

    const result = await apiCall<Board>('/api/boards', {
      method: 'POST',
      body: JSON.stringify({ name })
    });

    if (result.success) {
      setBoards(prev => prev.map(b => b.id === tempId ? result.data : b));
      // Navigate to the new board
      window.location.href = `/boards/${result.data.id}`;
    } else {
      setBoards(previousBoards);
      alert(`Failed to create board: ${result.error}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Boards</h1>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          + New Board
        </Button>
      </div>

      {boards.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">No boards yet. Create your first board to get started!</p>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            Create Your First Board
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => (
            <a
              key={board.id}
              href={`/boards/${board.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{board.name}</h2>
              <p className="text-sm text-gray-500">
                Created {new Date(board.created_at).toLocaleDateString()}
              </p>
            </a>
          ))}
        </div>
      )}

      <CreateBoardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateBoard}
      />
    </div>
  );
}
