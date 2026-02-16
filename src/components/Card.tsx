import type { Card } from '../types/entities';
import { getColorForLabel } from '../utils/cardColors';

interface CardProps {
  card: Card;
}

export default function Card({ card }: CardProps) {
  return (
    <div
      className="bg-white p-3 rounded shadow-sm border-l-4"
      style={{ borderLeftColor: getColorForLabel(card.color) }}
    >
      <h3 className="font-medium text-gray-900">{card.title}</h3>
      {card.description && (
        <p className="text-sm text-gray-600 mt-1 line-clamp-3">{card.description}</p>
      )}
    </div>
  );
}
