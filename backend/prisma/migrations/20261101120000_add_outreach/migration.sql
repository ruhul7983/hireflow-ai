-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'CAMPAIGN_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'CAMPAIGN_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE 'EMAIL_SENT';

-- AlterEnum
BEGIN;
CREATE TYPE "CampaignStatus_new" AS ENUM ('DRAFTING', 'DRAFT', 'SENDING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');
ALTER TABLE "public"."Campaign" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Campaign" ALTER COLUMN "status" TYPE "CampaignStatus_new" USING ("status"::text::"CampaignStatus_new");
ALTER TYPE "CampaignStatus" RENAME TO "CampaignStatus_old";
ALTER TYPE "CampaignStatus_new" RENAME TO "CampaignStatus";
DROP TYPE "public"."CampaignStatus_old";
ALTER TABLE "Campaign" ALTER COLUMN "status" SET DEFAULT 'DRAFTING';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CardType" ADD VALUE 'CAMPAIGN_PROPOSAL';
ALTER TYPE "CardType" ADD VALUE 'CAMPAIGN_DRAFTS';
ALTER TYPE "CardType" ADD VALUE 'CAMPAIGN_PROGRESS';

-- AlterEnum
ALTER TYPE "EmailStatus" ADD VALUE 'SENDING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PendingActionType" ADD VALUE 'CREATE_CAMPAIGN';
ALTER TYPE "PendingActionType" ADD VALUE 'SEND_CAMPAIGN';

-- DropIndex
DROP INDEX "OutboundEmail_status_sentAt_idx";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "conversationId" TEXT NOT NULL,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "senderName" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFTING';

-- AlterTable
ALTER TABLE "CampaignStep" DROP COLUMN "body",
DROP COLUMN "subject";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "campaignId" TEXT;

-- AlterTable
ALTER TABLE "OutboundEmail" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "error" TEXT,
ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "previewUrl" TEXT;

-- AlterTable
ALTER TABLE "PendingAction" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "campaignName" TEXT,
ADD COLUMN     "dailyLimit" INTEGER,
ADD COLUMN     "dayOffsets" INTEGER[],
ADD COLUMN     "instructions" TEXT;

-- CreateIndex
CREATE INDEX "OutboundEmail_status_dueAt_idx" ON "OutboundEmail"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
