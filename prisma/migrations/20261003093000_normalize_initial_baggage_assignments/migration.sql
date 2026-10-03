-- Initial employee baggage assignments are immediately active. Only rows
-- carrying a replacement marker remain pending admin approval.
UPDATE "LuggageItem"
SET "status" = 'CHECKED_IN'
WHERE "status" = 'TAG_REQUESTED'
  AND ("description" IS NULL OR "description" NOT LIKE 'REPLACEMENT_FOR:%');
