-- Migration: Fix auto_inactivate_clients() — created_by type mismatch
--
-- 015_auto_inactivate_clients.sql inserted the literal string
-- 'System (Auto-inactivation)' into status_changes.created_by, but that
-- column is UUID (FK to public.users), not TEXT. Every nightly cron run
-- has been erroring out with:
--   invalid input syntax for type uuid: "System (Auto-inactivation)"
-- so no client has ever actually been auto-inactivated. Since no "system"
-- user row exists to reference, created_by is set to NULL instead; the
-- descriptive text stays in exit_destination/notes as before.

CREATE OR REPLACE FUNCTION auto_inactivate_clients()
RETURNS INTEGER AS $$
DECLARE
    inactivated_count INTEGER := 0;
    client_record RECORD;
    last_activity_date DATE;
BEGIN
    FOR client_record IN
        SELECT p.id, p.first_name, p.last_name, p.enrollment_date
        FROM persons p
        WHERE p.exit_date IS NULL
    LOOP
        SELECT MAX(DATE(e.service_date)) INTO last_activity_date
        FROM encounters e
        WHERE e.person_id = client_record.id;

        IF last_activity_date IS NULL THEN
            last_activity_date := client_record.enrollment_date;
        END IF;

        IF last_activity_date < CURRENT_DATE - INTERVAL '90 days' THEN
            INSERT INTO status_changes (
                person_id,
                change_type,
                change_date,
                exit_destination,
                notes,
                created_by
            ) VALUES (
                client_record.id,
                'exit',
                CURRENT_DATE,
                'Auto-inactivated - No contact for 90 days',
                'Automatically inactivated due to no service interactions for 90+ days. Last activity: ' || last_activity_date::TEXT,
                NULL
            );

            UPDATE persons
            SET
                exit_date = CURRENT_DATE,
                exit_destination = 'Auto-inactivated - No contact for 90 days',
                exit_notes = 'Automatically inactivated due to no service interactions for 90+ days. Last activity: ' || last_activity_date::TEXT
            WHERE id = client_record.id;

            inactivated_count := inactivated_count + 1;
        END IF;
    END LOOP;

    RETURN inactivated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_inactivate_clients() IS 'Automatically marks clients as inactive if they have had no service interactions for 90+ days. Returns the count of clients inactivated. Fixed 2026-09-16: created_by type mismatch (UUID vs TEXT) that caused every run to silently fail.';

-- Pause the nightly job so the fix doesn't silently auto-exit the entire
-- 1323-person backlog unattended on the first run. Unschedule with:
--   SELECT cron.unschedule('auto-inactivate-clients');
-- Re-enable once the backlog has been reviewed/processed deliberately, e.g.:
--   SELECT cron.schedule('auto-inactivate-clients', '0 2 * * *', $$SELECT auto_inactivate_clients()$$);
