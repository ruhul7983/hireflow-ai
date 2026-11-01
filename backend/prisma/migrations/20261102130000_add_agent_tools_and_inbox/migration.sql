-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'JOB_UPDATED';

-- AlterEnum
ALTER TYPE "CampaignChange" ADD VALUE 'SEND';

-- AlterEnum
ALTER TYPE "CardType" ADD VALUE 'CONFIRMATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PendingActionType" ADD VALUE 'APPROVE_REPLY';
ALTER TYPE "PendingActionType" ADD VALUE 'RETRY_SCORING';
ALTER TYPE "PendingActionType" ADD VALUE 'UPDATE_JOB';
ALTER TYPE "PendingActionType" ADD VALUE 'CHANGE_AUTO_REPLY';

-- AlterTable
ALTER TABLE "CandidateReply" ADD COLUMN     "inboundMessageId" TEXT;

-- AlterTable
ALTER TABLE "PendingAction" ADD COLUMN     "confirmLabel" TEXT,
ADD COLUMN     "detail" TEXT,
ADD COLUMN     "enabled" BOOLEAN,
ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CandidateReply_inboundMessageId_key" ON "CandidateReply"("inboundMessageId");
