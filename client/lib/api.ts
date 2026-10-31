const SERVER_ERROR = "We couldn't reach the server. Please try again.";

export class ApiError extends Error {}

async function readError(response: Response) {
  if (response.status >= 500) return SERVER_ERROR;
  try {
    const { message } = await response.json();
    return (Array.isArray(message) ? message[0] : message) ?? SERVER_ERROR;
  } catch {
    return SERVER_ERROR;
  }
}

let refreshing: Promise<boolean> | null = null;

// Calls that fail together share one refresh, because each refresh rotates the token
export function refreshSession() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function send(path: string, init?: RequestInit) {
  const isJson = typeof init?.body === "string";

  return fetch(`/api${path}`, {
    ...init,
    headers: isJson ? { "content-type": "application/json" } : undefined,
  });
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await send(path, init);
    if (response.status === 401 && (await refreshSession())) {
      response = await send(path, init);
    }
  } catch {
    throw new ApiError(SERVER_ERROR);
  }

  if (response.status === 401) {
    // A full page load, so nothing from the ended session stays in memory
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new ApiError("Your session has ended. Please sign in again.");
  }
  if (!response.ok) {
    throw new ApiError(await readError(response));
  }
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : SERVER_ERROR;
}
