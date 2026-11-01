// src/llm/untrusted.ts
const DELIMITERS = /<\s*\/?\s*(candidate|candidate_reply|untrusted_content)\b[^>]*>/gi;

// Removes our own tags, so outside text can't close its block and pose as instructions
export function stripDelimiters(text: string) {
  return text.replace(DELIMITERS, '');
}
