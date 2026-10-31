"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="rounded-md border border-cream/50 px-3 py-1.5 text-sm font-medium text-cream transition-colors hover:bg-cream hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream disabled:opacity-60"
    >
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
