// src/replies/auto-reply.ts
import { ReplyClassification } from '@prisma/client';
import type { ReplyReading } from './reply-reader.service';

// A question can touch anything, so it always goes to the recruiter
const SIMPLE_CASES: ReplyClassification[] = [
  ReplyClassification.INTERESTED,
  ReplyClassification.WANTS_MEETING,
  ReplyClassification.NOT_INTERESTED,
];

// A link, an address, a figure or a price could be a promise nobody has checked
const RISKY_DRAFT = /https?:|www\.|@|\d{3,}|[$€£৳]/i;

const STEERS_THE_AI =
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(instructions?|prompts?|rules?)\b|\bsystem prompt\b|\byou are (an? )?(ai|assistant|bot|model)\b/i;

// Checked in code, so the reply being read can't talk its way past these rules
export function isSafeToAutoSend(
  replyBody: string,
  { classification, draft, needsRecruiter }: ReplyReading,
) {
  return (
    draft !== null &&
    !needsRecruiter &&
    SIMPLE_CASES.includes(classification) &&
    !RISKY_DRAFT.test(draft) &&
    !STEERS_THE_AI.test(replyBody)
  );
}
