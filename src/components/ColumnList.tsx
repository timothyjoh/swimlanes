import { useState } from 'react';
import { ColumnForm } from './ColumnForm';
import { ColumnCard } from './ColumnCard';
import type { Column } from '@/lib/db/types';

interface ColumnListProps {
  boardId: number;
  initialColumns: Column[];
}

export function ColumnList({ boardId, initialColumns }: ColumnListProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  const handleColumnAdded = (column: Column) => {
    setColumns([...columns, column]);
  };

  const handleColumnUpdated = (updated: Column) => {
    setColumns(columns.map(c => c.id === updated.id ? updated : c));
  };

  const handleColumnDeleted = (columnId: number) => {
    setColumns(columns.filter(c => c.id !== columnId));
  };

  const handleMoveUp = async (columnId: number) => {
    const index = columns.findIndex(c => c.id === columnId);
    if (index <= 0) return;

    const currentColumn = columns[index];
    const prevColumn = columns[index - 1];

    // Swap positions
    try {
      await Promise.all([
        fetch(`/api/columns/${currentColumn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: prevColumn.position }),
        }),
        fetch(`/api/columns/${prevColumn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: currentColumn.position }),
        }),
      ]);

      // Update local state
      const newColumns = [...columns];
      [newColumns[index], newColumns[index - 1]] = [newColumns[index - 1], newColumns[index]];
      setColumns(newColumns.map((c, i) => ({ ...c, position: i + 1 })));
    } catch (err) {
      console.error('Failed to reorder columns:', err);
    }
  };

  const handleMoveDown = async (columnId: number) => {
    const index = columns.findIndex(c => c.id === columnId);
    if (index >= columns.length - 1) return;

    const currentColumn = columns[index];
    const nextColumn = columns[index + 1];

    // Swap positions
    try {
      await Promise.all([
        fetch(`/api/columns/${currentColumn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: nextColumn.position }),
        }),
        fetch(`/api/columns/${nextColumn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: currentColumn.position }),
        }),
      ]);

      // Update local state
      const newColumns = [...columns];
      [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
      setColumns(newColumns.map((c, i) => ({ ...c, position: i + 1 })));
    } catch (err) {
      console.error('Failed to reorder columns:', err);
    }
  };

  return (
    <div>
      <ColumnForm boardId={boardId} onColumnAdded={handleColumnAdded} />

      {columns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No columns yet. Add your first column to get started!</p>
          <p className="text-gray-400 text-sm">Columns help you organize your tasks (like "To Do", "In Progress", "Done")</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column, index) => (
            <ColumnCard
              key={column.id}
              column={column}
              onColumnUpdated={handleColumnUpdated}
              onColumnDeleted={handleColumnDeleted}
              canMoveUp={index > 0}
              canMoveDown={index < columns.length - 1}
              onMoveUp={() => handleMoveUp(column.id)}
              onMoveDown={() => handleMoveDown(column.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
