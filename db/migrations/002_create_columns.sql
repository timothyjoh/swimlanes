-- Create columns table with foreign key to boards
CREATE TABLE IF NOT EXISTS columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- Index for fetching columns by board (most common query)
CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id);

-- Index for ordering columns within a board
CREATE INDEX IF NOT EXISTS idx_columns_board_position ON columns(board_id, position);
