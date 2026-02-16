import type { BoardWithColumns } from '../types/entities';
import Column from './Column';

interface BoardProps {
  board: BoardWithColumns;
}

export default function Board({ board }: BoardProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 overflow-x-auto h-screen bg-gray-50">
      {board.columns.length === 0 ? (
        <div className="text-center py-12 text-gray-500 w-full">
          <p>This board has no columns. Add a column to start organizing cards.</p>
        </div>
      ) : (
        board.columns.map((column) => (
          <Column key={column.id} column={column} />
        ))
      )}
    </div>
  );
}
