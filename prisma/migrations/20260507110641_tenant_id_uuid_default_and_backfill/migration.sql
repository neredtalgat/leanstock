CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "tenants"
ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

WITH remap AS (
  SELECT id AS old_id, gen_random_uuid()::text AS new_id
  FROM "tenants"
  WHERE id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
)
UPDATE "tenants" t
SET "id" = r.new_id
FROM remap r
WHERE t."id" = r.old_id;
