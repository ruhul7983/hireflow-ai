-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'REPLY_RECEIVED';
ALTER TYPE "ActivityType" ADD VALUE 'REPLY_SENT';

-- AlterEnum
ALTER TYPE "CardType" ADD VALUE 'CANDIDATE_REPLY';

-- AlterEnum
ALTER TYPE "EmailStatus" ADD VALUE 'STOPPED';

-- AlterEnum
ALTER TYPE "PendingActionType" ADD VALUE 'SEND_REPLY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReplyDraftStatus" ADD VALUE 'SENDING';
ALTER TYPE "ReplyDraftStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "CandidateReply" ADD COLUMN     "conversationId" TEXT NOT NULL,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "outboundEmailId" TEXT,
ADD COLUMN     "previewUrl" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "replyId" TEXT;

-- AlterTable
ALTER TABLE "PendingAction" ADD COLUMN     "replyId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "CandidateReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "CandidateReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateReply" ADD CONSTRAINT "CandidateReply_outboundEmailId_fkey" FOREIGN KEY ("outboundEmailId") REFERENCES "OutboundEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
