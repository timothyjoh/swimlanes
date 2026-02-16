export interface Board {
  id: number;
  name: string;
  created_at: string;
}

export interface NewBoard {
  name: string;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  created_at: string;
}

export interface NewColumn {
  board_id: number;
  name: string;
  position: number;
}
