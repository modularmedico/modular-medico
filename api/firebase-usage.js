// Vercel serverless function: GET /api/firebase-usage
// Admin-only. Reports how much of the Firebase free-tier quota is used/left:
//   - Cloud Storage bucket size (sum of object sizes)
//   - Firestore daily reads / writes / deletes (Cloud Monitoring, resets midnight Pacific)
//   - Firestore stored size (ESTIMATE: doc counts x sampled average doc size)
//
// Env vars (server-only, set in Vercel):
//   FIREBASE_SERVICE_ACCOUNT        required. Full service-account JSON (one line).
//   FIREBASE_STORAGE_BUCKET         optional. Defaults to the bucket in firebase-applet-config.json.
//   FIREBASE_FIRESTORE_DATABASE_ID  optional. Defaults to the id in firebase-applet-config.json.
//   FIREBASE_STORAGE_QUOTA_BYTES    optional. Default 5 GiB.
//   FIRESTORE_STORAGE_QUOTA_BYTES   optional. Default 1 GiB.
// The service account needs: Monitoring Viewer, Storage Object Viewer, Cloud Datastore Viewer.

import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const GIB = 1024 ** 3;
const DAILY_QUOTA = { reads: 50000, writes: 20000, deletes: 20000 };
const CACHE_MS = 5 * 60 * 1000;
const SAMPLE_PER_COLLECTION = 20;

let cache = null;

function loadAppletConfig() {
  try {
    return JSON.parse(readFileSync(new URL("../firebase-applet-config.json", import.meta.url), "utf8"));
  } catch {
    return {};
  }
}

function getApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("MISSING_SERVICE_ACCOUNT");
  const cfg = loadAppletConfig();
  return initializeApp({
    credential: cert(JSON.parse(raw)),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || cfg.storageBucket,
    projectId: cfg.projectId,
  });
}

// Start of the current Pacific-time day (Firestore quotas reset at midnight PT).
function startOfPacificDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now).reduce((a, p) => ((a[p.type] = p.value), a), {});
  const h = Number(parts.hour) % 24;
  const elapsedMs = ((h * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * 1000;
  return new Date(now.getTime() - elapsedMs);
}

async function sumMetric(app, projectId, metricTypes, start, end) {
  const token = (await app.options.credential.getAccessToken()).access_token;
  for (const type of metricTypes) {
    const params = new URLSearchParams({
      filter: `metric.type="${type}"`,
      "interval.startTime": start.toISOString(),
      "interval.endTime": end.toISOString(),
      "aggregation.alignmentPeriod": "3600s",
      "aggregation.perSeriesAligner": "ALIGN_SUM",
      "aggregation.crossSeriesReducer": "REDUCE_SUM",
    });
    const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) continue;
    const j = await r.json();
    if (!j.timeSeries) continue;
    let total = 0;
    for (const s of j.timeSeries) for (const p of s.points || []) total += Number(p.value?.int64Value ?? p.value?.doubleValue ?? 0);
    return total;
  }
  return null; // metric not available
}

async function storageBucketUsage(app) {
  const bucket = getStorage(app).bucket();
  let bytes = 0;
  let files = 0;
  let pageToken;
  do {
    const [list, next] = await bucket.getFiles({ autoPaginate: false, maxResults: 1000, pageToken });
    for (const f of list) {
      bytes += Number(f.metadata?.size || 0);
      files += 1;
    }
    pageToken = next?.pageToken;
  } while (pageToken);
  return { bytes, files, bucket: bucket.name };
}

async function firestoreSizeEstimate(app, databaseId) {
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  const cols = await db.listCollections();
  let docs = 0;
  let bytes = 0;
  const breakdown = [];
  for (const col of cols) {
    const count = (await col.count().get()).data().count;
    if (!count) continue;
    const snap = await col.limit(SAMPLE_PER_COLLECTION).get();
    let sampleBytes = 0;
    snap.forEach((d) => {
      // doc name + JSON payload approximates Firestore's stored size.
      sampleBytes += d.ref.path.length + 32 + JSON.stringify(d.data()).length;
    });
    const avg = snap.size ? sampleBytes / snap.size : 0;
    const est = Math.round(avg * count);
    docs += count;
    bytes += est;
    breakdown.push({ collection: col.id, docs: count, estBytes: est });
  }
  breakdown.sort((a, b) => b.estBytes - a.estBytes);
  // Firestore also stores index entries; a rough 1.5x overhead is applied.
  return { docs, estBytes: Math.round(bytes * 1.5), breakdown: breakdown.slice(0, 10) };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  let app;
  try {
    app = getApp();
  } catch (e) {
    return res.status(500).json({
      error: e.message === "MISSING_SERVICE_ACCOUNT"
        ? "Server is missing FIREBASE_SERVICE_ACCOUNT. Add the service-account JSON to Vercel Environment Variables and redeploy."
        : `Could not initialise Firebase Admin: ${e.message}`,
    });
  }

  // Only a signed-in user with the `admin` custom claim may read usage.
  try {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!m) return res.status(401).json({ error: "Missing auth token" });
    const decoded = await getAuth(app).verifyIdToken(m[1]);
    if (decoded.admin !== true) return res.status(403).json({ error: "Admin only" });
  } catch {
    return res.status(401).json({ error: "Invalid auth token" });
  }

  if (cache && Date.now() - cache.at < CACHE_MS && req.query?.refresh !== "1") {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  const cfg = loadAppletConfig();
  const projectId = cfg.projectId;
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || cfg.firestoreDatabaseId;
  const now = new Date();
  const dayStart = startOfPacificDay(now);

  const [storage, ops, fsSize] = await Promise.allSettled([
    storageBucketUsage(app),
    Promise.all([
      sumMetric(app, projectId, ["firestore.googleapis.com/document/read_ops_count", "firestore.googleapis.com/document/read_count"], dayStart, now),
      sumMetric(app, projectId, ["firestore.googleapis.com/document/write_ops_count", "firestore.googleapis.com/document/write_count"], dayStart, now),
      sumMetric(app, projectId, ["firestore.googleapis.com/document/delete_ops_count", "firestore.googleapis.com/document/delete_count"], dayStart, now),
    ]),
    firestoreSizeEstimate(app, databaseId),
  ]);

  const ok = (r) => (r.status === "fulfilled" ? r.value : null);
  const err = (r) => (r.status === "rejected" ? String(r.reason?.message || r.reason) : null);
  const opsVal = ok(ops);

  const data = {
    generatedAt: now.toISOString(),
    storage: ok(storage)
      ? { ...ok(storage), quotaBytes: Number(process.env.FIREBASE_STORAGE_QUOTA_BYTES) || 5 * GIB }
      : { error: err(storage) },
    firestoreStorage: ok(fsSize)
      ? { ...ok(fsSize), quotaBytes: Number(process.env.FIRESTORE_STORAGE_QUOTA_BYTES) || 1 * GIB, estimated: true }
      : { error: err(fsSize) },
    daily: opsVal
      ? {
          resetsAt: new Date(dayStart.getTime() + 24 * 3600 * 1000).toISOString(),
          reads: { used: opsVal[0], quota: DAILY_QUOTA.reads },
          writes: { used: opsVal[1], quota: DAILY_QUOTA.writes },
          deletes: { used: opsVal[2], quota: DAILY_QUOTA.deletes },
        }
      : { error: err(ops) },
  };

  cache = { at: Date.now(), data };
  res.status(200).json(data);
}
