import { env } from "@repo/env/email-worker";

type UserProfile = { id: string; name: string; email: string };

// P1 FIX: userId is now run through encodeURIComponent() before being
// interpolated into the URL path. Previously a userId like "../roles" would
// resolve to /admin/roles — giving the email worker access to arbitrary
// auth-service endpoints (path traversal / SSRF-adjacent).
//
// Additionally, the UUID format is validated before the fetch so clearly
// invalid IDs are rejected immediately without a network round-trip.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUserId(id: string): boolean {
  // Accept UUIDs or plain alphanumeric IDs (e.g. CUID, NanoID) up to 128 chars.
  // Reject anything containing path separators or protocol characters.
  if (!id || id.length > 128) return false;
  return UUID_RE.test(id) || /^[a-zA-Z0-9_-]+$/.test(id);
}

async function fetchProfile(
  userId: string,
  requestId?: string
): Promise<UserProfile | null> {
  if (!isValidUserId(userId)) {
    console.warn(JSON.stringify({ event: "user_client_invalid_id_rejected" }));
    return null;
  }

  try {
    const res = await fetch(
      `${env.AUTH_SERVICE_URL}/admin/users/${encodeURIComponent(userId)}`,
      {
        headers: {
          "x-service-token": env.INTERNAL_SERVICE_TOKEN,
          Accept: "application/json",
          ...(requestId ? { "x-request-id": requestId } : {}),
        },
        signal: AbortSignal.timeout(5_000),
      }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    const data = body?.["data"] ?? body;
    return data as UserProfile;
  } catch {
    return null;
  }
}

export async function fetchUserEmail(
  userId: string,
  requestId?: string
): Promise<string> {
  const profile = await fetchProfile(userId, requestId);
  if (!profile?.email) {
    // Do NOT log the userId here — it can be used to enumerate valid users.
    console.warn(JSON.stringify({ event: "user_email_not_found" }));
    return "";
  }
  return profile.email;
}

export async function fetchUserName(
  userId: string,
  requestId?: string
): Promise<string> {
  const profile = await fetchProfile(userId, requestId);
  return profile?.name ?? "Customer";
}
