export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-xl font-semibold ${className}`}>
      HireFlow
      <span className="ml-1.5 align-middle font-sans text-[0.625rem] font-semibold uppercase tracking-[0.2em]">
        AI
      </span>
    </span>
  );
}
