import { getFirebaseAuth } from "../firebase";

export interface QuotaPart { used: number | null; quota: number }
export interface FirebaseUsage {
  generatedAt: string;
  cached?: boolean;
  storage: { bytes: number; files: number; bucket: string; quotaBytes: number } | { error: string };
  firestoreStorage:
    | { docs: number; estBytes: number; quotaBytes: number; estimated: true; breakdown: { collection: string; docs: number; estBytes: number }[] }
    | { error: string };
  daily:
    | { resetsAt: string; reads: QuotaPart; writes: QuotaPart; deletes: QuotaPart }
    | { error: string };
}

/** Admin-only: asks the server (api/firebase-usage.js) for current usage vs. free quota. */
export async function fetchFirebaseUsage(refresh = false): Promise<FirebaseUsage> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Sign in as an admin to view usage.");
  const token = await user.getIdToken();
  const res = await fetch(`/api/firebase-usage${refresh ? "?refresh=1" : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as FirebaseUsage;
}
