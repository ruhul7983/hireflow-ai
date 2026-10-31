import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BACKEND_URL } from "@/lib/backend";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
};

// Reads the request, so callers must render inside a <Suspense> boundary
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  const response = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const { data } = await response.json();
  return data;
});

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
