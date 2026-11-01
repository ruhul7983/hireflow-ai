-- CreateEnum
CREATE TYPE "LlmPurpose" AS ENUM ('CHAT', 'SCORING', 'DRAFTING', 'REPLY');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'AUTO_REPLY_CHANGED';

-- AlterTable
ALTER TABLE "CandidateReply" ADD COLUMN     "autoSent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "autoReply" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LlmUsage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "conversationId" TEXT,
    "purpose" "LlmPurpose" NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmUsage_jobId_idx" ON "LlmUsage"("jobId");

-- CreateIndex
CREATE INDEX "LlmUsage_conversationId_idx" ON "LlmUsage"("conversationId");

-- AddForeignKey
ALTER TABLE "LlmUsage" ADD CONSTRAINT "LlmUsage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmUsage" ADD CONSTRAINT "LlmUsage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
