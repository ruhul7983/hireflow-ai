"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

const SERVER_ERROR = "We couldn't reach the server. Please try again.";

const fieldClass =
  "w-full rounded-lg border border-forest/40 bg-transparent px-3.5 py-2.5 text-base text-forest outline-none transition-shadow focus:border-forest focus:ring-2 focus:ring-forest/25";

async function readError(response: Response) {
  if (response.status >= 500) return SERVER_ERROR;
  try {
    const { message } = await response.json();
    return (Array.isArray(message) ? message[0] : message) ?? SERVER_ERROR;
  } catch {
    return SERVER_ERROR;
  }
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });

      if (response.ok) {
        router.replace("/");
        router.refresh();
        return;
      }

      setError(await readError(response));
    } catch {
      setError(SERVER_ERROR);
    }

    setPending(false);
  }

  return (
    // method="post" keeps the password out of the URL if submitted before hydration
    <form method="post" onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-forest bg-forest/10 px-3.5 py-2.5 text-sm font-medium"
        >
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          aria-invalid={Boolean(error)}
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={Boolean(error)}
            className={`${fieldClass} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 rounded-r-lg px-3.5 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-forest px-4 py-3 font-semibold text-cream transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
