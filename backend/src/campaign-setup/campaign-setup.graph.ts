// src/campaign-setup/campaign-setup.graph.ts
import {
  Annotation,
  END,
  interrupt,
  START,
  StateGraph,
} from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';

export type QuestionKey = 'recipients' | 'format' | 'timing' | 'limit' | 'tone';

export type QuestionOption = {
  label: string;
  value: string;
  description?: string;
  recommended?: boolean;
};

export type SetupQuestion = {
  key: QuestionKey;
  prompt: string;
  hint?: string;
  options: QuestionOption[];
};

export type SetupCandidate = { id: string; score: number | null };

const SKIP_TONE = 'none';
const TOP_GROUP = 3;

const TIMING_OPTIONS: QuestionOption[] = [
  {
    label: 'Day 0, 3, 7',
    value: '0,3,7',
    description: 'Three emails over a week',
    recommended: true,
  },
  { label: 'Day 0, 2, 5', value: '0,2,5', description: 'A faster follow-up' },
  { label: 'Day 0, 7, 14', value: '0,7,14', description: 'A gentler pace' },
  { label: 'Day 0, 4', value: '0,4', description: 'One follow-up only' },
];

const LIMIT_OPTIONS: QuestionOption[] = [
  { label: '10 a day', value: '10', description: 'Slow and careful' },
  {
    label: '25 a day',
    value: '25',
    description: 'A safe default',
    recommended: true,
  },
  { label: '50 a day', value: '50', description: 'Faster' },
];

const TONE_OPTIONS: QuestionOption[] = [
  {
    label: 'Friendly',
    value: 'Warm and friendly',
    recommended: true,
  },
  { label: 'Professional', value: 'Polite and professional' },
  { label: 'Short and direct', value: 'Very short and direct' },
  { label: 'No preference', value: SKIP_TONE },
];

function recipientsQuestion(candidates: SetupCandidate[]): SetupQuestion {
  const total = candidates.length;
  const topGroup = Math.max(1, Math.min(TOP_GROUP, Math.ceil(total / 2)));

  return {
    key: 'recipients',
    prompt: `${total} accepted candidates have an email address. Who should get this?`,
    hint: 'You can also type something like "top 2".',
    options: [
      {
        label: `All ${total} candidates`,
        value: 'all',
        recommended: true,
      },
      {
        label: `Top ${topGroup} by score`,
        value: `top:${topGroup}`,
        description: 'Only your strongest matches',
      },
    ],
  };
}

const FORMAT_QUESTION: SetupQuestion = {
  key: 'format',
  prompt: 'Should this be a single email or a sequence with follow-ups?',
  options: [
    {
      label: 'Sequence with follow-ups',
      value: 'sequence',
      description: 'Gets more replies',
      recommended: true,
    },
    { label: 'Single email', value: 'single', description: 'One email only' },
  ],
};

const TIMING_QUESTION: SetupQuestion = {
  key: 'timing',
  prompt: 'When should the emails go out?',
  hint: 'You can also type your own days, like "0, 4, 9".',
  options: TIMING_OPTIONS,
};

const LIMIT_QUESTION: SetupQuestion = {
  key: 'limit',
  prompt: 'How many emails can go out each day?',
  hint: 'You can also type your own number.',
  options: LIMIT_OPTIONS,
};

const TONE_QUESTION: SetupQuestion = {
  key: 'tone',
  prompt: 'What tone should the emails have?',
  hint: 'You can also type your own, like "mention the hybrid work".',
  options: TONE_OPTIONS,
};

export function topCandidates(candidates: SetupCandidate[], count: number) {
  return [...candidates]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, count)
    .map(({ id }) => id);
}

const SetupState = Annotation.Root({
  candidates: Annotation<SetupCandidate[]>,
  candidateIds: Annotation<string[] | null>,
  isSequence: Annotation<boolean | null>,
  dayOffsets: Annotation<number[] | null>,
  dailyLimit: Annotation<number | null>,
  instructions: Annotation<string | null | undefined>,
});

export type SetupValues = typeof SetupState.State;

// Each node pauses at interrupt() and continues only with the recruiter's answer.
// Whatever the recruiter already said is skipped, and nothing here is inferred.
function askRecipients(state: SetupValues) {
  if (state.candidateIds) return {};

  if (state.candidates.length === 1) {
    return { candidateIds: [state.candidates[0].id] };
  }

  const answer = interrupt<SetupQuestion, string>(
    recipientsQuestion(state.candidates),
  );

  return {
    candidateIds:
      answer === 'all'
        ? state.candidates.map(({ id }) => id)
        : topCandidates(state.candidates, Number(answer.split(':')[1])),
  };
}

function askFormat(state: SetupValues) {
  if (state.dayOffsets) return {};
  if (state.isSequence !== null) return {};

  const answer = interrupt<SetupQuestion, string>(FORMAT_QUESTION);
  return { isSequence: answer === 'sequence' };
}

function askTiming(state: SetupValues) {
  if (state.dayOffsets) return {};
  if (!state.isSequence) return { dayOffsets: [0] };

  const answer = interrupt<SetupQuestion, string>(TIMING_QUESTION);
  return { dayOffsets: answer.split(',').map(Number) };
}

function askLimit(state: SetupValues) {
  if (state.dailyLimit) return {};

  const answer = interrupt<SetupQuestion, string>(LIMIT_QUESTION);
  return { dailyLimit: Number(answer) };
}

function askTone(state: SetupValues) {
  if (state.instructions !== undefined) return {};

  const answer = interrupt<SetupQuestion, string>(TONE_QUESTION);
  return { instructions: answer === SKIP_TONE ? null : answer };
}

export function buildCampaignSetupGraph(checkpointer: BaseCheckpointSaver) {
  return new StateGraph(SetupState)
    .addNode('recipients', askRecipients)
    .addNode('format', askFormat)
    .addNode('timing', askTiming)
    .addNode('limit', askLimit)
    .addNode('tone', askTone)
    .addEdge(START, 'recipients')
    .addEdge('recipients', 'format')
    .addEdge('format', 'timing')
    .addEdge('timing', 'limit')
    .addEdge('limit', 'tone')
    .addEdge('tone', END)
    .compile({ checkpointer });
}
