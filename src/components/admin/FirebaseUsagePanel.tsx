import { useCallback, useEffect, useState } from "react";
import { HardDrive, Database, Activity, RefreshCw, AlertTriangle } from "lucide-react";
import Card from "../Card";
import Btn from "../Btn";
import Spinner from "../Spinner";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../../theme";
import { useAppStore } from "../../store/useAppStore";
import { fetchFirebaseUsage, type FirebaseUsage } from "../../services/firebaseUsage";

function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/** Admin > Firebase Usage: how much free-tier quota is used / left. */
export default function FirebaseUsagePanel() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [data, setData] = useState<FirebaseUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchFirebaseUsage(refresh));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load usage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const Bar = ({ used, quota, unit }: { used: number; quota: number; unit: (n: number) => string }) => {
    const pct = Math.min(100, (used / quota) * 100);
    const color = pct >= 90 ? t.red : pct >= 70 ? t.amber : t.green;
    return (
      <div className="mt-3">
        <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: t.chip[0] ?? t.surfaceAlt }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <div className="mt-2 flex items-baseline justify-between text-xs" style={{ color: t.textMuted }}>
          <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: t.text }}>{unit(used)} used</span>
          <span><b style={{ color }}>{unit(Math.max(0, quota - used))}</b> left of {unit(quota)} ({pct.toFixed(1)}%)</span>
        </div>
      </div>
    );
  };

  const Head = ({ icon: Icon, title }: { icon: typeof HardDrive; title: string }) => (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
      <Icon size={13} /> {title}
    </div>
  );

  const Err = ({ msg }: { msg: string }) => (
    <p className="mt-2 flex items-start gap-2 text-xs" style={{ color: t.red }}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {msg}
    </p>
  );

  return (
    <div className="flex flex-col gap-5">
      <Card t={t}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Firebase Usage</h2>
            <p className="mt-1 text-xs" style={{ color: t.textMuted }}>
              Free-tier quota remaining. Updated {data ? new Date(data.generatedAt).toLocaleTimeString() : "\u2026"}
              {data?.cached ? " (cached 5 min)" : ""}.
            </p>
          </div>
          <Btn t={t} variant="ghost" icon={RefreshCw} spin={loading} onClick={() => load(true)} disabled={loading}>
            Refresh
          </Btn>
        </div>
      </Card>

      {error && <Card t={t}><Err msg={error} /></Card>}
      {loading && !data && <div className="py-16 text-center"><Spinner t={t} size={24} label="Loading usage\u2026" /></div>}

      {data && (
        <>
          <Card t={t}>
            <Head icon={HardDrive} title="Cloud Storage (files)" />
            {"error" in data.storage ? <Err msg={data.storage.error} /> : (
              <>
                <Bar used={data.storage.bytes} quota={data.storage.quotaBytes} unit={fmtBytes} />
                <p className="mt-2 text-[11px]" style={{ color: t.textFaint }}>
                  {data.storage.files.toLocaleString()} files in {data.storage.bucket}
                </p>
              </>
            )}
          </Card>

          <Card t={t}>
            <Head icon={Database} title="Firestore database size (estimate)" />
            {"error" in data.firestoreStorage ? <Err msg={data.firestoreStorage.error} /> : (
              <>
                <Bar used={data.firestoreStorage.estBytes} quota={data.firestoreStorage.quotaBytes} unit={fmtBytes} />
                <p className="mt-2 text-[11px]" style={{ color: t.textFaint }}>
                  {data.firestoreStorage.docs.toLocaleString()} top-level documents. Estimated from sampled
                  document sizes; check Firebase Console for the exact figure.
                </p>
                {data.firestoreStorage.breakdown.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1">
                    {data.firestoreStorage.breakdown.map((b) => (
                      <div key={b.collection} className="flex justify-between text-xs" style={{ color: t.textMuted }}>
                        <span style={{ fontFamily: FONT_MONO }}>{b.collection}</span>
                        <span>{b.docs.toLocaleString()} docs \u00b7 ~{fmtBytes(b.estBytes)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          <Card t={t}>
            <Head icon={Activity} title="Firestore operations today" />
            {"error" in data.daily ? <Err msg={data.daily.error} /> : (
              <>
                {(["reads", "writes", "deletes"] as const).map((k) => {
                  const q = (data.daily as Exclude<FirebaseUsage["daily"], { error: string }>)[k];
                  return (
                    <div key={k} className="mt-4 first:mt-3">
                      <div className="text-sm font-bold capitalize">{k}</div>
                      {q.used === null
                        ? <Err msg="Metric unavailable (enable Cloud Monitoring API / grant Monitoring Viewer)." />
                        : <Bar used={q.used} quota={q.quota} unit={(n) => n.toLocaleString()} />}
                    </div>
                  );
                })}
                <p className="mt-3 text-[11px]" style={{ color: t.textFaint }}>
                  Resets at midnight Pacific ({new Date(data.daily.resetsAt).toLocaleString()} your time).
                  Monitoring data can lag a few minutes.
                </p>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
