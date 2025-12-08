-- Add shelter_unavailable column to encounters table
ALTER TABLE public.encounters
ADD COLUMN IF NOT EXISTS shelter_unavailable BOOLEAN DEFAULT false;
