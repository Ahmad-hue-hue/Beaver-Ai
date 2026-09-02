-- Drop the legacy plan / trial columns now that subscriptions live on User
-- (approvedAt + serviceExpiresAt) and no code references them.
ALTER TABLE "Business" DROP COLUMN "plan";
ALTER TABLE "Business" DROP COLUMN "trialEndsAt";
ALTER TABLE "Business" DROP COLUMN "planChangedAt";
ALTER TABLE "Business" DROP COLUMN "planChangedBy";