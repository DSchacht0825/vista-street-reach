-- Migration: Add service_types array field to support multiple interaction types per encounter
-- This replaces the singular service_subtype field

-- Add new service_types array column
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS service_types text[] DEFAULT '{}';

-- Migrate existing service_subtype data to service_types array
UPDATE encounters
SET service_types = ARRAY[service_subtype]
WHERE service_subtype IS NOT NULL AND service_subtype != '';

-- Create index for efficient filtering/searching by service types
CREATE INDEX IF NOT EXISTS idx_encounters_service_types ON encounters USING GIN(service_types);

-- Note: We keep the old service_subtype column for backward compatibility
-- It can be dropped in a future migration after confirming the new field works
