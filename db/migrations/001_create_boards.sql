-- Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for listing boards by creation date
CREATE INDEX IF NOT EXISTS idx_boards_created_at ON boards(created_at DESC);
