import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in | HireFlow AI",
};

async function RedirectIfSignedIn() {
  if (await getSessionUser()) redirect("/");
  return null;
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      <div className="w-full max-w-sm">
        <Wordmark />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">
          Sign in to your account
        </h1>
        <p className="mt-1 mb-6 text-muted">
          Use your admin account to continue.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
