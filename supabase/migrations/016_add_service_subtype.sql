-- Add service_subtype column to store Vista/Eponic interaction subtypes
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS service_subtype text;

-- Create index for efficient filtering/grouping by subtype
CREATE INDEX IF NOT EXISTS idx_encounters_service_subtype ON encounters(service_subtype);
