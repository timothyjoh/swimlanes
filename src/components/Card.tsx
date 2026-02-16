import type { Card } from '../types/entities';
import { getColorForLabel } from '../utils/cardColors';

interface CardProps {
  card: Card;
  columnId: number;
  isFirst: boolean;
  isLast: boolean;
  onClick: (card: Card) => void;
  onMove: (columnId: number, cardId: number, direction: 'up' | 'down') => void;
}

export default function Card({ card, columnId, isFirst, isLast, onClick, onMove }: CardProps) {
  return (
    <div
      className="bg-white p-3 rounded shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow group"
      style={{ borderLeftColor: getColorForLabel(card.color) }}
      onClick={() => onClick(card)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{card.title}</h3>
          {card.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-3">{card.description}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(columnId, card.id, 'up');
            }}
            disabled={isFirst}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed text-xs"
            title="Move up"
          >
            ↑
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(columnId, card.id, 'down');
            }}
            disabled={isLast}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed text-xs"
            title="Move down"
          >
            ↓
          </button>
        </div>
      </div>
    </div>
  );
}
