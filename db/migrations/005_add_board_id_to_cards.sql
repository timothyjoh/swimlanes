-- Add board_id for easier restore logic
ALTER TABLE cards ADD COLUMN board_id INTEGER;

-- Populate board_id from existing column relationships
UPDATE cards
SET board_id = (
  SELECT col.board_id
  FROM columns col
  WHERE col.id = cards.column_id
);

-- Recreate table with proper constraints (SQLite requires table recreation for NOT NULL)
CREATE TABLE cards_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  column_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);

INSERT INTO cards_new (id, board_id, column_id, title, description, color, position, created_at, updated_at, archived_at)
SELECT id, board_id, column_id, title, description, color, position, created_at, updated_at, archived_at FROM cards;

DROP TABLE cards;
ALTER TABLE cards_new RENAME TO cards;

CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_cards_position ON cards(position);
CREATE INDEX idx_cards_archived_at ON cards(archived_at);
CREATE INDEX idx_cards_board_id ON cards(board_id);
