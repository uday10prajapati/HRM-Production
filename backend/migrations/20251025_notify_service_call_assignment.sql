-- Migration: notify service_call assignments via NOTIFY
-- Creates a trigger function that emits a NOTIFY payload when a service_call is
-- inserted or its engineer_id changes. The backend listener picks up the payload
-- and sends notifications (SMS/FCM).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION notify_service_call_assignment()
RETURNS trigger AS $$
BEGIN
  -- On insert: if an engineer is present, notify
  IF TG_OP = 'INSERT' THEN
    IF NEW.engineer_id IS NOT NULL THEN
      PERFORM pg_notify('service_call_assigned', json_build_object('call_id', NEW.id::text, 'engineer_id', NEW.engineer_id::text)::text);
    END IF;
    RETURN NEW;
  END IF;

  -- On update: notify only if engineer_id was newly set or changed
  IF TG_OP = 'UPDATE' THEN
    IF NEW.engineer_id IS NOT NULL AND (OLD.engineer_id IS NULL OR NEW.engineer_id::text <> OLD.engineer_id::text) THEN
      PERFORM pg_notify('service_call_assigned', json_build_object('call_id', NEW.id::text, 'engineer_id', NEW.engineer_id::text)::text);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any and create a new one
DROP TRIGGER IF EXISTS trg_notify_service_call_assignment ON assign_call;
CREATE TRIGGER trg_notify_service_call_assignment
AFTER INSERT OR UPDATE ON assign_call
FOR EACH ROW
EXECUTE FUNCTION notify_service_call_assignment();
