import type { Column, Card as CardType } from '../types/entities';
import Card from './Card';

interface ColumnProps {
  column: Column & { cards: CardType[] };
}

export default function Column({ column }: ColumnProps) {
  return (
    <div className="flex-shrink-0 w-full md:w-80 flex flex-col bg-gray-100 rounded-lg max-h-screen">
      <div className="p-3 font-semibold border-b bg-gray-50 flex items-center justify-between">
        <span>{column.name}</span>
        <span className="text-xs text-gray-500 font-normal">
          {column.cards.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {column.cards.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">
            No cards yet
          </div>
        ) : (
          column.cards.map((card) => (
            <Card key={card.id} card={card} />
          ))
        )}
      </div>
    </div>
  );
}
