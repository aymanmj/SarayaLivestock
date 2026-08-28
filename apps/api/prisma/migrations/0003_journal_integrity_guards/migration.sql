-- Enforce fiscal ownership, dates and open periods below the application layer.
CREATE OR REPLACE FUNCTION validate_journal_entry_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  fiscal_status TEXT;
  fiscal_start DATE;
  fiscal_end DATE;
  matched_period_id TEXT;
  period_status TEXT;
  period_start DATE;
  period_end DATE;
  period_year_id TEXT;
BEGIN
  SELECT "status"::TEXT, "startDate", "endDate"
    INTO fiscal_status, fiscal_start, fiscal_end
  FROM "fiscal_years"
  WHERE "id" = NEW."fiscalYearId" AND "farmId" = NEW."farmId";

  IF NOT FOUND OR fiscal_status <> 'OPEN' THEN
    RAISE EXCEPTION 'journal fiscal year is missing, belongs to another farm, or is closed'
      USING ERRCODE = '23514';
  END IF;
  IF NEW."entryDate" < fiscal_start OR NEW."entryDate" > fiscal_end THEN
    RAISE EXCEPTION 'journal date is outside its fiscal year'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."fiscalPeriodId" IS NULL THEN
    SELECT "id" INTO matched_period_id
    FROM "fiscal_periods"
    WHERE "fiscalYearId" = NEW."fiscalYearId"
      AND "status" = 'OPEN'
      AND "startDate" <= NEW."entryDate"
      AND "endDate" >= NEW."entryDate"
    ORDER BY "periodNumber"
    LIMIT 1;
    IF matched_period_id IS NULL THEN
      RAISE EXCEPTION 'no open fiscal period covers the journal date'
        USING ERRCODE = '23514';
    END IF;
    NEW."fiscalPeriodId" := matched_period_id;
  ELSE
    SELECT "status"::TEXT, "startDate", "endDate", "fiscalYearId"
      INTO period_status, period_start, period_end, period_year_id
    FROM "fiscal_periods"
    WHERE "id" = NEW."fiscalPeriodId";

    IF NOT FOUND OR period_year_id <> NEW."fiscalYearId" OR period_status <> 'OPEN' THEN
      RAISE EXCEPTION 'journal fiscal period is missing, closed, or belongs to another fiscal year'
        USING ERRCODE = '23514';
    END IF;
    IF NEW."entryDate" < period_start OR NEW."entryDate" > period_end THEN
      RAISE EXCEPTION 'journal date is outside its fiscal period'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER journal_entry_period_integrity
BEFORE INSERT OR UPDATE ON "journal_entries"
FOR EACH ROW
EXECUTE FUNCTION validate_journal_entry_period();

-- Posted journals are accounting evidence. Corrections must use reversing entries.
CREATE OR REPLACE FUNCTION prevent_posted_journal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'POSTED' THEN
    RAISE EXCEPTION 'posted journal entries are immutable; create a reversing entry'
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER posted_journal_entries_immutable
BEFORE UPDATE OR DELETE ON "journal_entries"
FOR EACH ROW
EXECUTE FUNCTION prevent_posted_journal_mutation();

CREATE OR REPLACE FUNCTION prevent_posted_journal_line_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status TEXT;
BEGIN
  SELECT "status"::TEXT INTO parent_status
  FROM "journal_entries"
  WHERE "id" = OLD."journalEntryId";

  IF parent_status = 'POSTED' THEN
    RAISE EXCEPTION 'lines of posted journal entries are immutable; create a reversing entry'
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER posted_journal_lines_immutable
BEFORE UPDATE OR DELETE ON "journal_entry_lines"
FOR EACH ROW
EXECUTE FUNCTION prevent_posted_journal_line_mutation();
