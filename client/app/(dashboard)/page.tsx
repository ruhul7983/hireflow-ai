import { Suspense } from "react";
import { requireSessionUser } from "@/lib/auth";

async function Welcome() {
  const user = await requireSessionUser();

  return (
    <h1 className="font-display text-4xl font-medium">
      Welcome, {user.name ?? user.email}
    </h1>
  );
}

export default function Home() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Suspense fallback={<div className="h-10" />}>
          <Welcome />
        </Suspense>
      </div>
    </main>
  );
}
