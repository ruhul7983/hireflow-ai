import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BACKEND_URL } from "@/lib/backend";
import type { Dashboard } from "@/lib/dashboard-types";

// Reads the request, so callers must render inside a <Suspense> boundary
export async function getDashboard(): Promise<Dashboard | null> {
  const response = await fetch(`${BACKEND_URL}/dashboard`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });

  if (response.status === 401) redirect("/login");
  return response.ok ? response.json() : null;
}
