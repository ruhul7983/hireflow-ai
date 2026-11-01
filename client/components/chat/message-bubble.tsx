import { Bot } from "lucide-react";
import { CampaignChangeCard } from "@/components/chat/campaign-change-card";
import { CampaignDraftsCard } from "@/components/chat/campaign-drafts-card";
import { CampaignProgressCard } from "@/components/chat/campaign-progress-card";
import { CampaignProposalCard } from "@/components/chat/campaign-proposal-card";
import { CandidateTableCard } from "@/components/chat/candidate-table-card";
import { ConfirmationCard } from "@/components/chat/confirmation-card";
import { DecisionCard } from "@/components/chat/decision-card";
import { JobCreatedCard } from "@/components/chat/job-created-card";
import { JobDraftCard } from "@/components/chat/job-draft-card";
import { MeetingBookedCard } from "@/components/chat/meeting-booked-card";
import { ProgressCard } from "@/components/chat/progress-card";
import { QuestionCard } from "@/components/chat/question-card";
import { ReplyCard } from "@/components/chat/reply-card";
import { SourcingPromptCard } from "@/components/chat/sourcing-prompt-card";
import type { ChatMessage } from "@/lib/chat-types";

type MessageBubbleProps = {
  message: ChatMessage;
  conversationId: string;
  refreshKey: number;
  onChanged: () => void;
};

function Card({ message, conversationId, refreshKey, onChanged }: MessageBubbleProps) {
  const {
    cardType,
    jobDraft,
    job,
    sourcingRun,
    pendingAction,
    jobId,
    campaignId,
    question,
    reply,
    meeting,
  } = message;

  if (cardType === "JOB_DRAFT" && jobDraft && pendingAction) {
    return (
      <JobDraftCard
        key={pendingAction.status}
        draft={jobDraft}
        action={pendingAction}
        onChanged={onChanged}
      />
    );
  }
  if (cardType === "JOB_CREATED" && job) {
    return <JobCreatedCard job={job} />;
  }
  if (cardType === "SOURCING_PROMPT" && pendingAction) {
    return (
      <SourcingPromptCard
        action={pendingAction}
        conversationId={conversationId}
        onChanged={onChanged}
      />
    );
  }
  if (cardType === "SOURCING_PROGRESS" && sourcingRun) {
    return <ProgressCard run={sourcingRun} />;
  }
  if (cardType === "CANDIDATE_TABLE" && jobId) {
    return (
      <CandidateTableCard
        jobId={jobId}
        conversationId={conversationId}
        refreshKey={refreshKey}
        onChanged={onChanged}
      />
    );
  }
  if (cardType === "CANDIDATE_DECISION" && pendingAction) {
    return <DecisionCard action={pendingAction} onChanged={onChanged} />;
  }
  if (cardType === "CAMPAIGN_PROPOSAL" && pendingAction) {
    return <CampaignProposalCard action={pendingAction} onChanged={onChanged} />;
  }
  if (cardType === "CAMPAIGN_CHANGE" && pendingAction) {
    return <CampaignChangeCard action={pendingAction} onChanged={onChanged} />;
  }
  if (cardType === "CONFIRMATION" && pendingAction) {
    return <ConfirmationCard action={pendingAction} onChanged={onChanged} />;
  }
  if (cardType === "CAMPAIGN_DRAFTS" && campaignId) {
    return (
      <CampaignDraftsCard
        campaignId={campaignId}
        action={pendingAction}
        refreshKey={refreshKey}
        onChanged={onChanged}
      />
    );
  }
  if (cardType === "CAMPAIGN_PROGRESS" && campaignId) {
    return (
      <CampaignProgressCard
        campaignId={campaignId}
        refreshKey={refreshKey}
        onChanged={onChanged}
      />
    );
  }
  if (cardType === "QUESTION" && question) {
    return <QuestionCard question={question} onChanged={onChanged} />;
  }
  if (cardType === "CANDIDATE_REPLY" && reply) {
    return (
      <ReplyCard reply={reply} action={pendingAction} onChanged={onChanged} />
    );
  }
  if (cardType === "MEETING_BOOKED" && meeting) {
    return <MeetingBookedCard meeting={meeting} />;
  }
  return null;
}

export function MessageBubble(props: MessageBubbleProps) {
  const { message } = props;

  if (message.role === "USER") {
    return (
      <li className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-white">
          {message.content}
        </p>
      </li>
    );
  }

  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-strong"
      >
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="pt-1 text-sm break-words whitespace-pre-wrap">
          {message.content}
        </p>
        <Card {...props} />
      </div>
    </li>
  );
}
