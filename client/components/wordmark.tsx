export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white"
      >
        H
      </span>
      <span className="text-lg font-semibold tracking-tight">
        HireFlow <span className="text-brand">AI</span>
      </span>
    </span>
  );
}
