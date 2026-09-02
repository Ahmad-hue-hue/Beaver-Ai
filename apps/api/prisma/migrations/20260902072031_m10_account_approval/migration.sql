-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "serviceExpiresAt" TIMESTAMP(3);

-- Backfill: grandfather every existing account as approved + active for 30 days
-- from the migration, so the monthly renewal cycle applies going forward.
UPDATE "User"
SET "approvedAt" = NOW(),
    "serviceExpiresAt" = NOW() + INTERVAL '30 days'
WHERE "approvedAt" IS NULL;
