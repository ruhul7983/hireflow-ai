import "server-only";
import { getFromBackend } from "@/lib/backend-fetch";
import type { Dashboard } from "@/lib/dashboard-types";

export function getDashboard() {
  return getFromBackend<Dashboard>("/dashboard");
}
