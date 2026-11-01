import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BACKEND_URL } from "@/lib/backend";
import { toQueryString } from "@/lib/list";
import type { Paged } from "@/lib/list";

// Reads the request, so callers must render inside a <Suspense> boundary
export async function getFromBackend<T>(path: string): Promise<T | null> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });

  if (response.status === 401) redirect("/login");
  return response.ok ? response.json() : null;
}

export function getList<T>(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  return getFromBackend<Paged<T>>(`${path}?${toQueryString(params)}`);
}
