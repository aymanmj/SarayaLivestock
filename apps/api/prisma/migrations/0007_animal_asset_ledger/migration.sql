-- Existing aggregate balances are deliberately not allocated to individual animals.
ALTER TABLE "journal_entry_lines" ADD COLUMN "animalId" TEXT;
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_animalId_fkey"
  FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "journal_entry_lines_animalId_idx" ON "journal_entry_lines"("animalId");

CREATE FUNCTION validate_animal_ledger_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."animalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "animals" a
    JOIN "journal_entries" j ON j."id" = NEW."journalEntryId" AND j."farmId" = a."farmId"
    JOIN "accounts" c ON c."id" = NEW."accountId" AND c."farmId" = a."farmId"
    WHERE a."id" = NEW."animalId" AND c."code" IN ('1201', '1202', '1203')
  ) THEN
    RAISE EXCEPTION 'animal ledger line must use a biological asset account in the same farm' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER animal_ledger_line_integrity BEFORE INSERT OR UPDATE ON "journal_entry_lines"
FOR EACH ROW EXECUTE FUNCTION validate_animal_ledger_line();
