import { useState } from 'react';
import type { BoardWithColumns } from '../types/entities';
import type { Card } from '../types/entities';
import Column from './Column';
import CreateCardModal from './CreateCardModal';
import EditCardModal from './EditCardModal';
import ConfirmDialog from './ConfirmDialog';
import EditableText from './EditableText';
import Button from './Button';
import { apiCall } from '../utils/api';

interface BoardProps {
  initialBoard: BoardWithColumns;
}

export default function Board({ initialBoard }: BoardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [columns, setColumns] = useState(initialBoard.columns);

  // UI state
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [createCardModal, setCreateCardModal] = useState<{ isOpen: boolean; columnId: number | null }>({
    isOpen: false,
    columnId: null
  });
  const [editCardModal, setEditCardModal] = useState<{ isOpen: boolean; card: Card | null }>({
    isOpen: false,
    card: null
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'board' | 'column' | 'card';
    id: number;
    name: string;
  } | null>(null);

  // Board handlers
  const handleUpdateBoardName = async (newName: string) => {
    const previousName = board.name;
    setBoard({ ...board, name: newName });

    const result = await apiCall(`/api/boards/${board.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newName })
    });

    if (!result.success) {
      setBoard({ ...board, name: previousName });
      alert(`Failed to update board name: ${result.error}`);
    }
  };

  const handleDeleteBoard = async () => {
    const result = await apiCall(`/api/boards/${board.id}`, { method: 'DELETE' });

    if (result.success) {
      window.location.href = '/';
    } else {
      alert(`Failed to delete board: ${result.error}`);
    }
  };

  // Column handlers
  const handleCreateColumn = async () => {
    if (!newColumnName.trim()) return;

    const tempId = Date.now();
    const tempColumn: any = {
      id: tempId,
      board_id: board.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      name: newColumnName,
      position: columns.length,
      cards: []
    };

    const previousColumns = [...columns];
    setColumns([...previousColumns, tempColumn]);
    setNewColumnName('');
    setIsAddingColumn(false);

    const result = await apiCall('/api/columns', {
      method: 'POST',
      body: JSON.stringify({
        boardId: board.id,
        name: newColumnName,
        position: columns.length
      })
    });

    if (result.success) {
      setColumns(prev => prev.map(c => c.id === tempId ? result.data as any : c));
    } else {
      setColumns(previousColumns);
      alert(`Failed to create column: ${result.error}`);
    }
  };

  const handleUpdateColumnName = async (columnId: number, newName: string) => {
    const previousColumns = [...columns];
    setColumns(prev => prev.map(c => c.id === columnId ? { ...c, name: newName } : c));

    const result = await apiCall(`/api/columns/${columnId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newName })
    });

    if (!result.success) {
      setColumns(previousColumns);
      alert(`Failed to update column name: ${result.error}`);
    }
  };

  const handleDeleteColumn = async (columnId: number) => {
    const previousColumns = [...columns];
    setColumns(prev => prev.filter(c => c.id !== columnId));

    const result = await apiCall(`/api/columns/${columnId}`, { method: 'DELETE' });

    if (!result.success) {
      setColumns(previousColumns);
      alert(`Failed to delete column: ${result.error}`);
    }

    setDeleteConfirm(null);
  };

  const handleMoveColumn = async (columnId: number, direction: 'up' | 'down') => {
    const columnIndex = columns.findIndex(c => c.id === columnId);
    if (columnIndex === -1) return;

    const newIndex = direction === 'up' ? columnIndex - 1 : columnIndex + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;

    const previousColumns = [...columns];
    const reordered = [...columns];
    [reordered[columnIndex], reordered[newIndex]] = [reordered[newIndex], reordered[columnIndex]];
    setColumns(reordered);

    const result = await apiCall(`/api/columns/${columnId}/position`, {
      method: 'PUT',
      body: JSON.stringify({ position: newIndex })
    });

    if (!result.success) {
      setColumns(previousColumns);
      alert(`Failed to reorder column: ${result.error}`);
    }
  };

  // Card handlers
  const handleCreateCard = async (columnId: number, cardData: { title: string; description: string; color: string }) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const tempId = Date.now();
    const tempCard = {
      id: tempId,
      column_id: columnId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      position: column.cards.length,
      ...cardData
    };

    const previousColumns = [...columns];
    setColumns(prev => prev.map(c =>
      c.id === columnId ? { ...c, cards: [...c.cards, tempCard as any] } : c
    ));

    const result = await apiCall('/api/cards', {
      method: 'POST',
      body: JSON.stringify({
        columnId,
        position: column.cards.length,
        ...cardData
      })
    });

    if (result.success) {
      setColumns(prev => prev.map(c =>
        c.id === columnId
          ? { ...c, cards: c.cards.map(card => card.id === tempId ? result.data as any : card) }
          : c
      ));
    } else {
      setColumns(previousColumns);
      alert(`Failed to create card: ${result.error}`);
    }

    setCreateCardModal({ isOpen: false, columnId: null });
  };

  const handleUpdateCard = async (cardId: number, updates: { title?: string; description?: string; color?: string }) => {
    const previousColumns = [...columns];
    setColumns(prev => prev.map(c => ({ ...c, 
      ...c,
      cards: c.cards.map(card => card.id === cardId ? { ...card, ...updates } as any : card)
    })));

    const result = await apiCall(`/api/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });

    if (!result.success) {
      setColumns(previousColumns);
      alert(`Failed to update card: ${result.error}`);
    }

    setEditCardModal({ isOpen: false, card: null });
  };

  const handleDeleteCard = async (cardId: number) => {
    const previousColumns = [...columns];
    setColumns(prev => prev.map(c => ({ ...c, 
      ...c,
      cards: c.cards.filter(card => card.id !== cardId)
    })));

    const result = await apiCall(`/api/cards/${cardId}`, { method: 'DELETE' });

    if (!result.success) {
      setColumns(previousColumns);
      alert(`Failed to delete card: ${result.error}`);
    }

    setDeleteConfirm(null);
    setEditCardModal({ isOpen: false, card: null });
  };

  const handleMoveCard = async (columnId: number, cardId: number, direction: 'up' | 'down') => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const cardIndex = column.cards.findIndex(card => card.id === cardId);
    if (cardIndex === -1) return;

    const newIndex = direction === 'up' ? cardIndex - 1 : cardIndex + 1;
    if (newIndex < 0 || newIndex >= column.cards.length) return;

    const previousColumns = [...columns];
    const updatedCards = [...column.cards];
    [updatedCards[cardIndex], updatedCards[newIndex]] = [updatedCards[newIndex], updatedCards[cardIndex]];

    setColumns(prev => prev.map(c =>
      c.id === columnId ? { ...c, cards: updatedCards } : c
    ));

    const result = await apiCall(`/api/cards/${cardId}/position`, {
      method: 'PUT',
      body: JSON.stringify({ position: newIndex })
    });

    if (!result.success) {
      setColumns(previousColumns);
      alert(`Failed to reorder card: ${result.error}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Board header */}
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-blue-600 hover:underline">&larr; Back to Boards</a>
          <EditableText
            value={board.name}
            onSave={handleUpdateBoardName}
            className="text-2xl font-bold"
            inputClassName="text-2xl font-bold"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteConfirm({ type: 'board', id: board.id, name: board.name })}
        >
          🗑️ Delete Board
        </Button>
      </div>

      {/* Columns */}
      <div className="flex flex-col md:flex-row gap-4 p-4 overflow-x-auto flex-1">
        {columns.length === 0 ? (
          <div className="text-center py-12 text-gray-500 w-full">
            <p>This board has no columns. Add a column to start organizing cards.</p>
          </div>
        ) : (
          columns.map((column, index) => (
            <Column
              key={column.id}
              column={column}
              isFirst={index === 0}
              isLast={index === columns.length - 1}
              onUpdateName={handleUpdateColumnName}
              onDelete={(id) => setDeleteConfirm({ type: 'column', id, name: column.name })}
              onMove={handleMoveColumn}
              onAddCard={(id) => setCreateCardModal({ isOpen: true, columnId: id })}
              onEditCard={(card) => setEditCardModal({ isOpen: true, card })}
              onMoveCard={handleMoveCard}
            />
          ))
        )}

        {/* Add Column button */}
        <div className="flex-shrink-0 w-full md:w-80">
          {isAddingColumn ? (
            <div className="bg-gray-100 rounded-lg p-3">
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateColumn();
                  if (e.key === 'Escape') {
                    setIsAddingColumn(false);
                    setNewColumnName('');
                  }
                }}
                placeholder="Column name"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
              />
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleCreateColumn}>
                  Add Column
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsAddingColumn(false);
                    setNewColumnName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              + Add Column
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateCardModal
        isOpen={createCardModal.isOpen}
        onClose={() => setCreateCardModal({ isOpen: false, columnId: null })}
        columnId={createCardModal.columnId || 0}
        onSubmit={handleCreateCard}
      />

      <EditCardModal
        isOpen={editCardModal.isOpen}
        onClose={() => setEditCardModal({ isOpen: false, card: null })}
        card={editCardModal.card}
        onSubmit={handleUpdateCard}
        onDelete={(id) => setDeleteConfirm({ type: 'card', id, name: editCardModal.card?.title || '' })}
      />

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.type === 'board') handleDeleteBoard();
          else if (deleteConfirm?.type === 'column') handleDeleteColumn(deleteConfirm.id);
          else if (deleteConfirm?.type === 'card') handleDeleteCard(deleteConfirm.id);
        }}
        title={`Delete ${deleteConfirm?.type}`}
        message={
          deleteConfirm?.type === 'board'
            ? 'Are you sure you want to delete this board? All columns and cards will be permanently deleted. This action cannot be undone.'
            : deleteConfirm?.type === 'column'
            ? `Delete column "${deleteConfirm.name}"? All cards in this column will be permanently deleted.`
            : `Delete card "${deleteConfirm?.name}"? This action cannot be undone.`
        }
        confirmText="Delete"
        danger={true}
      />
    </div>
  );
}
