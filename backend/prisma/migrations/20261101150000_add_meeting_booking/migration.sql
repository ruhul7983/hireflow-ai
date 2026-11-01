-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'MEETING_BOOKED';

-- AlterEnum
ALTER TYPE "CardType" ADD VALUE 'MEETING_BOOKED';

-- AlterEnum
ALTER TYPE "MeetingStatus" ADD VALUE 'DRAFTED';

-- AlterTable
ALTER TABLE "Meeting" DROP COLUMN "bookingUrl",
ADD COLUMN     "conversationId" TEXT NOT NULL,
ADD COLUMN     "replyId" TEXT,
ADD COLUMN     "token" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFTED';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "meetingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_replyId_key" ON "Meeting"("replyId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_token_key" ON "Meeting"("token");

-- CreateIndex
CREATE INDEX "Meeting_startsAt_idx" ON "Meeting"("startsAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "CandidateReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
