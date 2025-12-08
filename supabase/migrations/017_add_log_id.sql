-- Add log_id column to track Eponic Log IDs for deduplication and matching
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS log_id bigint;

-- Create unique index to prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_encounters_log_id ON encounters(log_id) WHERE log_id IS NOT NULL;
