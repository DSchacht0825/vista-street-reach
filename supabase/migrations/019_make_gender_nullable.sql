-- Make gender nullable since it's optional in the intake form
-- This fixes the issue where saving a new client fails when gender is not selected
ALTER TABLE public.persons
ALTER COLUMN gender DROP NOT NULL;
