-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING', 'ANSWERED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "CardType" ADD VALUE 'QUESTION';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "questionId" TEXT;

-- CreateTable
CREATE TABLE "AgentQuestion" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING',
    "answerLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AgentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "AgentQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCheckpoint" (
    "threadId" TEXT NOT NULL,
    "checkpointNs" TEXT NOT NULL DEFAULT '',
    "checkpointId" TEXT NOT NULL,
    "parentCheckpointId" TEXT,
    "dataType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "metadataType" TEXT NOT NULL,
    "metadata" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCheckpoint_pkey" PRIMARY KEY ("threadId","checkpointNs","checkpointId")
);

-- CreateTable
CREATE TABLE "AgentCheckpointWrite" (
    "threadId" TEXT NOT NULL,
    "checkpointNs" TEXT NOT NULL DEFAULT '',
    "checkpointId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "taskPath" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "value" BYTEA NOT NULL,

    CONSTRAINT "AgentCheckpointWrite_pkey" PRIMARY KEY ("threadId","checkpointNs","checkpointId","taskId","idx")
);

-- CreateIndex
CREATE INDEX "AgentQuestion_conversationId_status_idx" ON "AgentQuestion"("conversationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentQuestionOption_questionId_position_key" ON "AgentQuestionOption"("questionId", "position");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AgentQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentQuestion" ADD CONSTRAINT "AgentQuestion_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentQuestionOption" ADD CONSTRAINT "AgentQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AgentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
