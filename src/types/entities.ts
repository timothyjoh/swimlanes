export interface Board {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

// Extended types for nested queries
export interface ColumnWithCards extends Column {
  cards: Card[];
}

export interface BoardWithColumns extends Board {
  columns: ColumnWithCards[];
}
