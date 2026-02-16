import type { Column as ColumnType, Card as CardType } from '../types/entities';
import Card from './Card';
import EditableText from './EditableText';
import Button from './Button';

interface ColumnProps {
  column: ColumnType & { cards: CardType[] };
  isFirst: boolean;
  isLast: boolean;
  onUpdateName: (columnId: number, name: string) => Promise<void>;
  onDelete: (columnId: number) => void;
  onMove: (columnId: number, direction: 'up' | 'down') => void;
  onAddCard: (columnId: number) => void;
  onEditCard: (card: CardType) => void;
  onMoveCard: (columnId: number, cardId: number, direction: 'up' | 'down') => void;
}

export default function Column({
  column,
  isFirst,
  isLast,
  onUpdateName,
  onDelete,
  onMove,
  onAddCard,
  onEditCard,
  onMoveCard
}: ColumnProps) {
  return (
    <div className="flex-shrink-0 w-full md:w-80 flex flex-col bg-gray-100 rounded-lg max-h-screen">
      {/* Column header */}
      <div className="p-3 border-b bg-gray-50 flex items-center justify-between gap-2">
        <EditableText
          value={column.name}
          onSave={(newName) => onUpdateName(column.id, newName)}
          className="font-semibold flex-1"
          inputClassName="font-semibold"
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 font-normal mr-2">
            {column.cards.length}
          </span>
          <button
            onClick={() => onMove(column.id, 'up')}
            disabled={isFirst}
            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move left"
          >
            ←
          </button>
          <button
            onClick={() => onMove(column.id, 'down')}
            disabled={isLast}
            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move right"
          >
            →
          </button>
          <button
            onClick={() => onDelete(column.id)}
            className="p-1 hover:bg-red-100 rounded text-red-600"
            title="Delete column"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {column.cards.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">
            No cards yet
          </div>
        ) : (
          column.cards.map((card, index) => (
            <Card
              key={card.id}
              card={card}
              columnId={column.id}
              isFirst={index === 0}
              isLast={index === column.cards.length - 1}
              onClick={onEditCard}
              onMove={onMoveCard}
            />
          ))
        )}
      </div>

      {/* Add card button */}
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddCard(column.id)}
          className="w-full"
        >
          + Add Card
        </Button>
      </div>
    </div>
  );
}
