import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in | HireFlow AI",
};

const PIPELINE = ["Job description", "Sourcing", "Outreach", "Interview", "Hired"];

async function RedirectIfSignedIn() {
  if (await getSessionUser()) redirect("/");
  return null;
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      <section className="flex flex-col justify-between bg-forest px-6 py-6 text-cream lg:w-1/2 lg:p-14">
        <Wordmark className="text-2xl" />

        <div className="hidden lg:block">
          <h1 className="font-display max-w-md text-5xl leading-[1.1] font-medium text-balance">
            From job description to hire, in one conversation.
          </h1>
          <ol className="mt-12 space-y-4">
            {PIPELINE.map((step, index) => (
              <li key={step} className="flex items-baseline gap-4">
                <span className="w-5 text-xs tabular-nums opacity-70">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="hidden text-sm opacity-70 lg:block">
          Your AI recruiting co-worker
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium">Sign in</h2>
          <p className="mt-2 mb-8 opacity-80">
            Use your admin account to continue.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
