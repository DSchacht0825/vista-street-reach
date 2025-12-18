-- Add refused_services field to encounters table
-- This is distinct from refused_shelter:
-- refused_services = client refused ALL help/services
-- refused_shelter = client specifically declined shelter placement but may have accepted other services

ALTER TABLE encounters ADD COLUMN IF NOT EXISTS refused_services BOOLEAN DEFAULT FALSE;

-- Add comment to clarify the distinction
COMMENT ON COLUMN encounters.refused_services IS 'Client refused all services/help during this encounter';
COMMENT ON COLUMN encounters.refused_shelter IS 'Client specifically declined shelter placement';
