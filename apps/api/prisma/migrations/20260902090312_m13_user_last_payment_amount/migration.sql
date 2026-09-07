-- Track the last subscription payment amount on the account (admin console).
ALTER TABLE "User" ADD COLUMN "lastPaymentAmount" DECIMAL(14,2);
