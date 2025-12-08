-- Add placement_detox_name column to encounters table
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS placement_detox_name text;
