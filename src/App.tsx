import { lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Shell from "./components/Shell";
import AdminLayout from "./components/AdminLayout";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
const Subjects = lazy(() => import("./pages/Subjects"));
const HubBrowse = lazy(() => import("./pages/HubBrowse"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const PracticeSetup = lazy(() => import("./pages/PracticeSetup"));
const Practice = lazy(() => import("./pages/Practice"));
const Tests = lazy(() => import("./pages/Tests"));
const Search = lazy(() => import("./pages/Search"));
const Results = lazy(() => import("./pages/Results"));
const Builder = lazy(() => import("./pages/Builder"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const Profile = lazy(() => import("./pages/Profile"));
const Lectures = lazy(() => import("./pages/Lectures"));
const OspeBooks = lazy(() => import("./pages/OspeBooks"));
const StudyNotes = lazy(() => import("./pages/StudyNotes"));
const PastPaperList = lazy(() => import("./pages/PastPaperList"));
const Shop = lazy(() => import("./pages/Shop"));
const AdminGate = lazy(() => import("./pages/AdminGate"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Paywall = lazy(() => import("./pages/Paywall"));
import NotFound from "./pages/NotFound";
import { subscribeAuth } from "./services/auth";
import { subscribeUserProfile } from "./services/firestore";
import { subscribeFreeBlocks, subscribeFreeSubjects, subscribeTestSeriesAccess } from "./services/adminContent";
import { useAppStore } from "./store/useAppStore";
import { initAnalytics } from "./firebase";
import { trackVisit } from "./services/siteStats";
import { prefetchWhenIdle } from "./utils/localCache";

// Blocks direct access to /admin. Anyone who isn't already unlocked (via the
// admin-gate password screen) gets bounced to /admin-gate instead of seeing the panel.
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const isAdmin = useAppStore((s) => s.isAdmin);
  if (!isAdmin) return <Navigate to="/admin-gate" replace />;
  return <>{children}</>;
}

// Old URLs keep working: they forward into the new browse flow (Past Papers: Block > Subheading).
function RedirectToBrowse({ kind }: { kind: "mcqs" | "papers" }) {
  const { block } = useParams();
  return <Navigate to={`/browse/${kind}${block ? `/${block}` : ""}`} replace />;
}

export default function App() {
  const setAuthUser = useAppStore((s) => s.setAuthUser);
  const setProfile = useAppStore((s) => s.setProfile);
  const setAuthReady = useAppStore((s) => s.setAuthReady);
  const setFreeBlocks = useAppStore((s) => s.setFreeBlocks);
  const setFreeSubjects = useAppStore((s) => s.setFreeSubjects);
  const setTestSeriesEnabled = useAppStore((s) => s.setTestSeriesEnabled);
  const uid = useAppStore((s) => s.uid);

  useEffect(() => {
    initAnalytics();
    // Records one visit for this browser session (see services/siteStats.ts).
    // Best-effort and silent — never blocks or affects the rest of the app.
    trackVisit();
    // Pre-download the screens students open next, while the browser is idle, so tapping
    // "Practice" never waits on a code chunk as well as on data.
    prefetchWhenIdle(() => {
      // Failures here are harmless (the real navigation retries), so never let them surface.
      import("./pages/HubBrowse").catch(() => {});
      import("./pages/PracticeSetup").catch(() => {});
      import("./pages/Practice").catch(() => {});
    }, 4000);
  }, []);

  // Keep which Blocks are free live for the lifetime of the app, so an
  // admin's toggle on the "Manage Access" tab takes effect immediately for
  // every open tab/session without needing a redeploy.
  useEffect(() => {
    const unsub = subscribeFreeBlocks(setFreeBlocks);
    return unsub;
  }, [setFreeBlocks]);

  // Same for per-subject free access inside paid blocks.
  useEffect(() => subscribeFreeSubjects(setFreeSubjects), [setFreeSubjects]);

  // Same for the global Test Series on/off switch.
  useEffect(() => subscribeTestSeriesAccess(setTestSeriesEnabled), [setTestSeriesEnabled]);

  // Keep the store in sync with Firebase Auth for the lifetime of the app.
  useEffect(() => {
    const unsub = subscribeAuth((user) => {
      if (user) {
        setAuthUser(user.uid, user.email, user.displayName ?? "");
      } else {
        setAuthUser(null, null, "");
        setProfile(null);
      }
      setAuthReady(true);
    });
    return unsub;
  }, [setAuthUser, setProfile, setAuthReady]);

  // Once signed in, keep the Firestore profile (streak, daily goal, premium status) live.
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeUserProfile(uid, setProfile);
    return unsub;
  }, [uid, setProfile]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Student-facing site, wrapped in the shared shell (top bar + nav) */}
        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/subjects/block/:block" element={<RedirectToBrowse kind="mcqs" />} />
          <Route path="/browse/:kind" element={<HubBrowse />} />
          <Route path="/browse/:kind/:block" element={<HubBrowse />} />
          <Route path="/browse/:kind/:block/:moduleId" element={<HubBrowse />} />
          <Route path="/browse/:kind/:block/:moduleId/:subjectId" element={<HubBrowse />} />
          <Route path="/subjects/:subjectId" element={<SubjectDetail />} />
          <Route path="/subjects/:subjectId/:moduleId/:block" element={<PracticeSetup />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/search" element={<Search />} />
          <Route path="/results" element={<Results />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/lectures" element={<Lectures />} />
          <Route path="/ospe-books" element={<OspeBooks />} />
          <Route path="/study-notes" element={<StudyNotes />} />
          <Route path="/past-papers" element={<RedirectToBrowse kind="papers" />} />
          <Route path="/past-papers/:block" element={<PastPaperList />} />
          <Route path="/past-papers/:block/:subjectId" element={<RedirectToBrowse kind="papers" />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/paywall" element={<Paywall />} />
        </Route>

        {/* Admin — deliberately outside the student shell and not linked from the homepage */}
        <Route element={<AdminLayout />}>
          <Route path="/admin-gate" element={<AdminGate />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPanel />
              </RequireAdmin>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
