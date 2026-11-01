import type { Metadata } from "next";
import { Suspense } from "react";
import { Wordmark } from "@/components/wordmark";
import { BookingPicker } from "./booking-picker";

export const metadata: Metadata = {
  title: "Pick a time | HireFlow AI",
  robots: { index: false },
};

export default function BookingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-6 py-10">
      <Wordmark />
      <Suspense fallback={<p className="text-sm text-muted">Loading times…</p>}>
        <BookingPicker />
      </Suspense>
    </main>
  );
}
