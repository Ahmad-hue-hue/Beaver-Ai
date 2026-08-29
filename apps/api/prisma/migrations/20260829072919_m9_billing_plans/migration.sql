-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "planChangedAt" TIMESTAMP(3),
ADD COLUMN     "planChangedBy" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
