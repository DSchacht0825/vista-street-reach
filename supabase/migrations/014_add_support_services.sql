-- Add support_services column to encounters table
-- This stores an array of support service codes (e.g., 'birth_certificate', 'ss_card', etc.)
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS support_services text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN encounters.support_services IS 'Array of support service codes: birth_certificate, ss_card, food_stamps, medi_cal, food_provided';
