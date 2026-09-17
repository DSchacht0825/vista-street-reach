-- Migration: Allow auto_inactivate_clients() to run in batches
--
-- 022 fixed the created_by bug, but the entire 1323-person backlog now
-- qualifies at once, and the function has no way to process a subset.
-- This adds an optional p_batch_size param: when set, only the N most
-- overdue clients (oldest last-activity date first) are exited per call,
-- so the backlog can be cleared manually in controlled chunks. Called with
-- no argument (as the nightly cron does), behavior is unchanged — all
-- qualifying clients are processed in one run.

CREATE OR REPLACE FUNCTION auto_inactivate_clients(p_batch_size INTEGER DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    inactivated_count INTEGER := 0;
    client_record RECORD;
BEGIN
    FOR client_record IN
        SELECT
            p.id,
            p.first_name,
            p.last_name,
            COALESCE(MAX(e.service_date::date), p.enrollment_date) AS last_activity_date
        FROM persons p
        LEFT JOIN encounters e ON e.person_id = p.id
        WHERE p.exit_date IS NULL
        GROUP BY p.id, p.first_name, p.last_name, p.enrollment_date
        HAVING COALESCE(MAX(e.service_date::date), p.enrollment_date) < CURRENT_DATE - INTERVAL '90 days'
        ORDER BY last_activity_date ASC
        LIMIT p_batch_size
    LOOP
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
            'Automatically inactivated due to no service interactions for 90+ days. Last activity: ' || client_record.last_activity_date::TEXT,
            NULL
        );

        UPDATE persons
        SET
            exit_date = CURRENT_DATE,
            exit_destination = 'Auto-inactivated - No contact for 90 days',
            exit_notes = 'Automatically inactivated due to no service interactions for 90+ days. Last activity: ' || client_record.last_activity_date::TEXT
        WHERE id = client_record.id;

        inactivated_count := inactivated_count + 1;
    END LOOP;

    RETURN inactivated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_inactivate_clients(INTEGER) IS 'Marks clients inactive (exit_date) if no service interactions for 90+ days. Optional p_batch_size processes only the N most-overdue clients per call, oldest first; omit to process all (used by nightly cron). Returns count processed.';
