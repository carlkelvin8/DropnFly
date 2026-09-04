DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PointsTransaction"
    WHERE "reference" IS NOT NULL
    GROUP BY "reference", "type"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate loyalty transactions detected; reconcile them before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "PointsTransaction_reference_type_key" ON "PointsTransaction"("reference", "type");
