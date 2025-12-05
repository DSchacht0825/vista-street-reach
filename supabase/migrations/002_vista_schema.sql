-- Vista Street Reach Schema Migration
-- This updates the schema to match Vista's data format while keeping Encinitas dashboard structure

-- Add new columns to persons table for Vista-specific fields
ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS aka TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS height TEXT,
  ADD COLUMN IF NOT EXISTS weight TEXT,
  ADD COLUMN IF NOT EXISTS hair_color TEXT,
  ADD COLUMN IF NOT EXISTS eye_color TEXT,
  ADD COLUMN IF NOT EXISTS physical_description TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS last_contact DATE,
  ADD COLUMN IF NOT EXISTS contact_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS income TEXT,
  ADD COLUMN IF NOT EXISTS income_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS sexual_orientation TEXT,
  ADD COLUMN IF NOT EXISTS domestic_violence_victim BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chronic_health BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mental_health BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS addictions TEXT[],
  ADD COLUMN IF NOT EXISTS evictions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS support_system TEXT,
  ADD COLUMN IF NOT EXISTS release_of_information BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exit_date DATE,
  ADD COLUMN IF NOT EXISTS exit_destination TEXT,
  ADD COLUMN IF NOT EXISTS exit_notes TEXT;

-- Make some fields nullable that Vista doesn't require
ALTER TABLE public.persons
  ALTER COLUMN last_name DROP NOT NULL,
  ALTER COLUMN date_of_birth DROP NOT NULL,
  ALTER COLUMN race DROP NOT NULL,
  ALTER COLUMN ethnicity DROP NOT NULL,
  ALTER COLUMN living_situation DROP NOT NULL;

-- Add placement fields to encounters
ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS placement_made BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS placement_location TEXT,
  ADD COLUMN IF NOT EXISTS placement_location_other TEXT,
  ADD COLUMN IF NOT EXISTS refused_shelter BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS high_utilizer_contact BOOLEAN DEFAULT FALSE;

-- Create status_changes table for tracking exits and returns
CREATE TABLE IF NOT EXISTS public.status_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('exit', 'return_to_active')),
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  exit_destination TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for status_changes
CREATE INDEX IF NOT EXISTS idx_status_changes_person_id ON public.status_changes(person_id);
CREATE INDEX IF NOT EXISTS idx_status_changes_date ON public.status_changes(change_date DESC);

-- Enable RLS on status_changes
ALTER TABLE public.status_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for status_changes
CREATE POLICY "Authenticated users can view all status_changes"
  ON public.status_changes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert status_changes"
  ON public.status_changes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create function to check if person is active (contacted within last 90 days)
CREATE OR REPLACE FUNCTION is_person_active(person_last_contact DATE)
RETURNS BOOLEAN AS $$
BEGIN
  IF person_last_contact IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN person_last_contact >= CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to get active persons (for by-name list)
CREATE OR REPLACE FUNCTION get_active_persons()
RETURNS TABLE (
  id UUID,
  client_id TEXT,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  aka TEXT,
  age INTEGER,
  gender TEXT,
  ethnicity TEXT,
  last_contact DATE,
  contact_count INTEGER,
  days_since_contact INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.client_id,
    p.first_name,
    p.middle_name,
    p.last_name,
    p.aka,
    p.age,
    p.gender,
    p.ethnicity,
    p.last_contact,
    p.contact_count,
    CASE
      WHEN p.last_contact IS NOT NULL THEN (CURRENT_DATE - p.last_contact)::INTEGER
      ELSE NULL
    END as days_since_contact
  FROM public.persons p
  WHERE
    p.exit_date IS NULL  -- Not exited
    AND is_person_active(p.last_contact)  -- Contacted within 90 days
  ORDER BY p.last_contact DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get inactive persons (not contacted in 90+ days)
CREATE OR REPLACE FUNCTION get_inactive_persons()
RETURNS TABLE (
  id UUID,
  client_id TEXT,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  aka TEXT,
  age INTEGER,
  gender TEXT,
  ethnicity TEXT,
  last_contact DATE,
  contact_count INTEGER,
  days_since_contact INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.client_id,
    p.first_name,
    p.middle_name,
    p.last_name,
    p.aka,
    p.age,
    p.gender,
    p.ethnicity,
    p.last_contact,
    p.contact_count,
    CASE
      WHEN p.last_contact IS NOT NULL THEN (CURRENT_DATE - p.last_contact)::INTEGER
      ELSE NULL
    END as days_since_contact
  FROM public.persons p
  WHERE
    p.exit_date IS NULL  -- Not exited
    AND NOT is_person_active(p.last_contact)  -- NOT contacted within 90 days
  ORDER BY p.last_contact DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_person_active TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_persons TO authenticated;
GRANT EXECUTE ON FUNCTION get_inactive_persons TO authenticated;

-- Update the client_id sequence prefix for Vista
-- New clients will get VS-XXXXXX format
ALTER SEQUENCE person_id_seq RESTART WITH 1;

-- Function to generate Vista client IDs
CREATE OR REPLACE FUNCTION generate_vista_client_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'VS-' || LPAD(nextval('person_id_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
