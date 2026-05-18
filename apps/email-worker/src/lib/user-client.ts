import { env } from "@repo/env";

type UserProfile = { id: string; name: string; email: string };

// Simple internal call to auth-service to resolve a userId → email/name.
// Uses x-service-token so auth-service treats it as an internal call.
//
// This is a fallback used when the email job payload does not already contain
// userEmail (old producers that pre-date the EML-03 payload update).
// Once all producers include userEmail, these fetches become unreachable.

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${env.AUTH_SERVICE_URL}/admin/users/${userId}`, {
      headers: {
        "x-service-token": env.INTERNAL_SERVICE_TOKEN,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data ?? body) as UserProfile;
  } catch {
    return null;
  }
}

export async function fetchUserEmail(userId: string): Promise<string> {
  const profile = await fetchProfile(userId);
  if (!profile?.email) {
    console.warn(JSON.stringify({ event: "user_email_not_found", userId }));
    return "";
  }
  return profile.email;
}

export async function fetchUserName(userId: string): Promise<string> {
  const profile = await fetchProfile(userId);
  return profile?.name ?? "Customer";
}
