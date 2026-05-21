-- Add fields for tracking how clients came to Vista and how long they've been there
ALTER TABLE persons ADD COLUMN IF NOT EXISTS how_came_to_vista TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS time_in_vista TEXT;
