# Vista Street Reach - Supabase Setup Guide

## Overview

This guide walks you through setting up the Supabase database for Vista Street Reach.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Name it `vista-street-reach`
4. Choose a strong database password (save this!)
5. Select region closest to you (e.g., West US)
6. Click "Create new project"

## Step 2: Run Database Schema

Go to **SQL Editor** in Supabase dashboard and run this SQL:

```sql
-- =====================================================
-- VISTA STREET REACH - DATABASE SCHEMA
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create sequence for client_id
CREATE SEQUENCE IF NOT EXISTS person_id_seq START 1;

-- Create users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'field_worker')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create persons table (by-name list)
CREATE TABLE public.persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT UNIQUE NOT NULL DEFAULT 'VS-' || LPAD(nextval('person_id_seq')::TEXT, 6, '0'),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT,
  nickname TEXT,
  aka TEXT,
  age INTEGER,
  date_of_birth DATE,
  gender TEXT,
  race TEXT DEFAULT 'Unknown',
  ethnicity TEXT,

  -- Physical Description (Vista-specific)
  height TEXT,
  weight TEXT,
  hair_color TEXT,
  eye_color TEXT,
  physical_description TEXT,

  -- Contact tracking
  phone_number TEXT,
  photo_url TEXT,
  notes TEXT,
  last_contact DATE,
  contact_count INTEGER DEFAULT 0,

  -- Status fields
  veteran_status BOOLEAN NOT NULL DEFAULT FALSE,
  disability_status BOOLEAN NOT NULL DEFAULT FALSE,
  disability_type TEXT,
  chronic_homeless BOOLEAN NOT NULL DEFAULT FALSE,
  domestic_violence_victim BOOLEAN DEFAULT FALSE,
  chronic_health BOOLEAN DEFAULT FALSE,
  mental_health BOOLEAN DEFAULT FALSE,
  addictions TEXT[],
  living_situation TEXT DEFAULT 'Unknown',
  length_of_time_homeless TEXT,
  evictions INTEGER DEFAULT 0,
  support_system TEXT,

  -- Income
  income TEXT,
  income_amount NUMERIC(10,2),

  -- Program fields
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  case_manager TEXT,
  referral_source TEXT,
  preferred_language TEXT,
  cultural_lived_experience TEXT,
  sexual_orientation TEXT,
  release_of_information BOOLEAN DEFAULT FALSE,

  -- Exit tracking
  exit_date DATE,
  exit_destination TEXT,
  exit_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create encounters table (service interactions)
CREATE TABLE public.encounters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  service_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  outreach_location TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  outreach_worker TEXT NOT NULL,
  referral_source TEXT,
  language_preference TEXT,
  cultural_notes TEXT,
  co_occurring_mh_sud BOOLEAN NOT NULL DEFAULT FALSE,
  co_occurring_type TEXT,
  mat_referral BOOLEAN NOT NULL DEFAULT FALSE,
  mat_type TEXT,
  mat_provider TEXT,
  detox_referral BOOLEAN NOT NULL DEFAULT FALSE,
  detox_provider TEXT,
  fentanyl_test_strips_count INTEGER,
  harm_reduction_education BOOLEAN NOT NULL DEFAULT FALSE,
  transportation_provided BOOLEAN NOT NULL DEFAULT FALSE,
  shower_trailer BOOLEAN NOT NULL DEFAULT FALSE,
  placement_made BOOLEAN DEFAULT FALSE,
  placement_location TEXT,
  placement_location_other TEXT,
  refused_shelter BOOLEAN DEFAULT FALSE,
  high_utilizer_contact BOOLEAN DEFAULT FALSE,
  other_services TEXT,
  case_management_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create status_changes table for tracking exits and returns
CREATE TABLE public.status_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('exit', 'return_to_active')),
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  exit_destination TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_persons_first_name_trgm ON public.persons USING gin (first_name gin_trgm_ops);
CREATE INDEX idx_persons_last_name_trgm ON public.persons USING gin (last_name gin_trgm_ops);
CREATE INDEX idx_persons_nickname_trgm ON public.persons USING gin (nickname gin_trgm_ops);
CREATE INDEX idx_persons_aka_trgm ON public.persons USING gin (aka gin_trgm_ops);
CREATE INDEX idx_persons_client_id ON public.persons(client_id);
CREATE INDEX idx_persons_last_contact ON public.persons(last_contact DESC NULLS LAST);
CREATE INDEX idx_encounters_person_id ON public.encounters(person_id);
CREATE INDEX idx_encounters_service_date ON public.encounters(service_date DESC);
CREATE INDEX idx_encounters_location ON public.encounters(latitude, longitude);
CREATE INDEX idx_status_changes_person_id ON public.status_changes(person_id);
CREATE INDEX idx_status_changes_date ON public.status_changes(change_date DESC);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if person is active (contacted within last 90 days)
CREATE OR REPLACE FUNCTION is_person_active(person_last_contact DATE)
RETURNS BOOLEAN AS $$
BEGIN
  IF person_last_contact IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN person_last_contact >= CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get active persons (for by-name list)
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
    p.exit_date IS NULL
    AND is_person_active(p.last_contact)
  ORDER BY p.last_contact DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get inactive persons (not contacted in 90+ days)
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
    p.exit_date IS NULL
    AND NOT is_person_active(p.last_contact)
  ORDER BY p.last_contact DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fuzzy search function
CREATE OR REPLACE FUNCTION search_similar_persons(
  search_first_name TEXT,
  search_last_name TEXT,
  search_dob DATE DEFAULT NULL,
  similarity_threshold REAL DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  client_id TEXT,
  first_name TEXT,
  last_name TEXT,
  nickname TEXT,
  aka TEXT,
  date_of_birth DATE,
  age INTEGER,
  similarity_score REAL,
  last_contact DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.client_id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.aka,
    p.date_of_birth,
    p.age,
    GREATEST(
      similarity(p.first_name, search_first_name),
      COALESCE(similarity(p.last_name, search_last_name), 0),
      COALESCE(similarity(p.nickname, search_first_name), 0),
      COALESCE(similarity(p.aka, search_first_name), 0)
    ) as similarity_score,
    p.last_contact
  FROM public.persons p
  WHERE
    (
      similarity(p.first_name, search_first_name) > similarity_threshold OR
      similarity(p.last_name, search_last_name) > similarity_threshold OR
      similarity(p.nickname, search_first_name) > similarity_threshold OR
      similarity(p.aka, search_first_name) > similarity_threshold
    )
    AND (
      search_dob IS NULL OR
      p.date_of_birth = search_dob
    )
  ORDER BY similarity_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER update_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_encounters_updated_at
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_changes ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Persons policies
CREATE POLICY "Authenticated users can view all persons"
  ON public.persons FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert persons"
  ON public.persons FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update persons"
  ON public.persons FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Encounters policies
CREATE POLICY "Authenticated users can view all encounters"
  ON public.encounters FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert encounters"
  ON public.encounters FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update encounters"
  ON public.encounters FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Status changes policies
CREATE POLICY "Authenticated users can view all status_changes"
  ON public.status_changes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert status_changes"
  ON public.status_changes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION is_person_active TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_persons TO authenticated;
GRANT EXECUTE ON FUNCTION get_inactive_persons TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_persons TO authenticated;
```

## Step 3: Set Up Authentication

1. Go to **Authentication** > **Providers**
2. Enable **Email** provider
3. Disable "Confirm email" for easier testing (optional)

## Step 4: Create First Admin User

1. Go to **Authentication** > **Users**
2. Click "Add user"
3. Enter email and password
4. After user is created, go to **SQL Editor** and run:

```sql
-- Replace 'user-uuid-here' with the actual UUID from the Users table
-- Replace the email with the actual email you used

1

## Step 5: Get Your API Keys

1. Go to **Settings** > **API**
2. Copy these values for your `.env.local` file:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (for import script)

## Step 6: Create .env.local File

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Mapbox for GPS features
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...
```

## Step 7: Import Existing Clients

After setting up Supabase, import your 1076 existing clients:

```bash
# Install dependencies
npm install

# Run import script
npx ts-node scripts/import-vista-clients.ts
```

## Step 8: Run the App

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with your admin credentials.

---

## Database Schema Summary

### Tables

| Table | Description |
|-------|-------------|
| `users` | Staff accounts (admin, field_worker) |
| `persons` | Client by-name list |
| `encounters` | Service interactions with GPS |
| `status_changes` | Exit/return tracking |

### Key Vista Fields in `persons`

| Field | Type | Description |
|-------|------|-------------|
| `first_name` | TEXT | Required |
| `middle_name` | TEXT | Optional |
| `last_name` | TEXT | Optional |
| `aka` | TEXT | Nicknames (e.g., "Big Mike, Red") |
| `age` | INTEGER | Age in years |
| `gender` | TEXT | Gender |
| `ethnicity` | TEXT | Ethnicity |
| `height` | TEXT | Height (e.g., "5'10\"") |
| `weight` | TEXT | Weight (e.g., "180 lbs") |
| `hair_color` | TEXT | Hair color |
| `eye_color` | TEXT | Eye color |
| `physical_description` | TEXT | Tattoos, scars, etc. |
| `notes` | TEXT | General notes |
| `last_contact` | DATE | Last contact date |
| `contact_count` | INTEGER | Total contacts |

### 90-Day Active Status Logic

- **Active**: `last_contact` within 90 days, not exited
- **Inactive**: `last_contact` > 90 days ago OR never contacted, not exited
- **Exited**: Has `exit_date` set

Use `get_active_persons()` and `get_inactive_persons()` SQL functions to query by status.
