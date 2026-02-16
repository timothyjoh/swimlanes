-- Add archived_at column for soft-delete functionality
ALTER TABLE cards ADD COLUMN archived_at TEXT DEFAULT NULL;

-- Index for filtering archived vs active cards
CREATE INDEX idx_cards_archived_at ON cards(archived_at);
