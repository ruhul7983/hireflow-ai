-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('JOB_DRAFT', 'JOB_CREATED', 'SOURCING_PROMPT', 'SOURCING_PROGRESS', 'CANDIDATE_TABLE', 'CANDIDATE_DECISION');

-- CreateEnum
CREATE TYPE "RemotePolicy" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PendingActionType" AS ENUM ('CREATE_JOB', 'START_SOURCING', 'DECIDE_CANDIDATES');

-- CreateEnum
CREATE TYPE "PendingActionStatus" AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('SERPER', 'CSV');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('SOURCED', 'ACCEPTED', 'REJECTED', 'CONTACTED', 'REPLIED', 'INTERESTED', 'NOT_INTERESTED', 'MEETING_BOOKED', 'INTERVIEWED', 'SHORTLISTED', 'HIRED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'SOURCING', 'SCORING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActivityActor" AS ENUM ('RECRUITER', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('JOB_CREATED', 'SOURCING_STARTED', 'SOURCING_FINISHED', 'CANDIDATE_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENDING', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ReplyClassification" AS ENUM ('INTERESTED', 'NOT_INTERESTED', 'QUESTION', 'WANTS_MEETING', 'UNSUBSCRIBE');

-- CreateEnum
CREATE TYPE "ReplyDraftStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'SENT', 'DISCARDED');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('LINK_SENT', 'BOOKED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "cardType" "CardType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobDraftId" TEXT,
    "jobId" TEXT,
    "sourcingRunId" TEXT,
    "pendingActionId" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDraft" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "title" TEXT,
    "seniority" TEXT,
    "location" TEXT,
    "salary" TEXT,
    "remotePolicy" "RemotePolicy",
    "mustHaveSkills" TEXT[],
    "niceToHaveSkills" TEXT[],
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seniority" TEXT,
    "location" TEXT,
    "salary" TEXT,
    "remotePolicy" "RemotePolicy",
    "mustHaveSkills" TEXT[],
    "niceToHaveSkills" TEXT[],
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" "PendingActionType" NOT NULL,
    "status" "PendingActionStatus" NOT NULL DEFAULT 'PENDING',
    "jobDraftId" TEXT,
    "jobId" TEXT,
    "decision" "CandidateStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PendingAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingActionCandidate" (
    "pendingActionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,

    CONSTRAINT "PendingActionCandidate_pkey" PRIMARY KEY ("pendingActionId","candidateId")
);

-- CreateTable
CREATE TABLE "SourcingRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "source" "CandidateSource" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "searchQuery" TEXT,
    "fileName" TEXT,
    "foundCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "scoredCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SourcingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourcingRunId" TEXT,
    "source" "CandidateSource" NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "profileUrl" TEXT,
    "headline" TEXT,
    "location" TEXT,
    "snippet" TEXT,
    "score" INTEGER,
    "scoreReason" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'SOURCED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT,
    "actor" "ActivityActor" NOT NULL,
    "type" "ActivityType" NOT NULL,
    "fromStatus" "CandidateStatus",
    "toStatus" "CandidateStatus",
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "dailyLimit" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "CampaignStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundEmail" (
    "id" TEXT NOT NULL,
    "campaignStepId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateReply" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "classification" "ReplyClassification",
    "draftBody" TEXT,
    "draftStatus" "ReplyDraftStatus",
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "bookingUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "status" "MeetingStatus" NOT NULL DEFAULT 'LINK_SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobDraft_jobId_key" ON "JobDraft"("jobId");

-- CreateIndex
CREATE INDEX "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PendingAction_conversationId_status_idx" ON "PendingAction"("conversationId", "status");

-- CreateIndex
CREATE INDEX "SourcingRun_jobId_idx" ON "SourcingRun"("jobId");

-- CreateIndex
CREATE INDEX "Candidate_jobId_status_idx" ON "Candidate"("jobId", "status");

-- CreateIndex
CREATE INDEX "Candidate_jobId_score_idx" ON "Candidate"("jobId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_jobId_email_key" ON "Candidate"("jobId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_jobId_profileUrl_key" ON "Candidate"("jobId", "profileUrl");

-- CreateIndex
CREATE INDEX "ActivityLog_jobId_createdAt_idx" ON "ActivityLog"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_jobId_idx" ON "Campaign"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignStep_campaignId_position_key" ON "CampaignStep"("campaignId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_candidateId_key" ON "CampaignRecipient"("campaignId", "candidateId");

-- CreateIndex
CREATE INDEX "OutboundEmail_status_sentAt_idx" ON "OutboundEmail"("status", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundEmail_campaignStepId_candidateId_key" ON "OutboundEmail"("campaignStepId", "candidateId");

-- CreateIndex
CREATE INDEX "CandidateReply_candidateId_receivedAt_idx" ON "CandidateReply"("candidateId", "receivedAt");

-- CreateIndex
CREATE INDEX "Meeting_candidateId_idx" ON "Meeting"("candidateId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_jobDraftId_fkey" FOREIGN KEY ("jobDraftId") REFERENCES "JobDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sourcingRunId_fkey" FOREIGN KEY ("sourcingRunId") REFERENCES "SourcingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_pendingActionId_fkey" FOREIGN KEY ("pendingActionId") REFERENCES "PendingAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDraft" ADD CONSTRAINT "JobDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDraft" ADD CONSTRAINT "JobDraft_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_jobDraftId_fkey" FOREIGN KEY ("jobDraftId") REFERENCES "JobDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingActionCandidate" ADD CONSTRAINT "PendingActionCandidate_pendingActionId_fkey" FOREIGN KEY ("pendingActionId") REFERENCES "PendingAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingActionCandidate" ADD CONSTRAINT "PendingActionCandidate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingRun" ADD CONSTRAINT "SourcingRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_sourcingRunId_fkey" FOREIGN KEY ("sourcingRunId") REFERENCES "SourcingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignStep" ADD CONSTRAINT "CampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_campaignStepId_fkey" FOREIGN KEY ("campaignStepId") REFERENCES "CampaignStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateReply" ADD CONSTRAINT "CandidateReply_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
