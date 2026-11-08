import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import {
  Activity, ArrowDownToLine, ArrowRight, Award, BarChart3, BriefcaseBusiness, Camera, Mic,
  CalendarDays, Check, ChevronLeft, CircleHelp,
  CloudUpload, FileText, GraduationCap, LayoutDashboard, Lightbulb, LoaderCircle,
  LogOut, Menu, MessageSquareText, Moon, Plus, Settings,
  Sparkles, Target, Trash2, TrendingUp, Trophy, Upload, Users, X,
} from "lucide-react";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  Link, Navigate, Outlet, Route, Routes, useLocation,
} from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, jsonRequest, setTokenProvider } from "./api";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBtPNgsU-UNxrTsYRODcmIF8FhEgGjRIKc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "carrerinfinity-28ab1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "carrerinfinity-28ab1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "carrerinfinity-28ab1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "70680959232",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:70680959232:web:9e4edfb7221a523a5c3be5",
};
const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
setTokenProvider(async forceRefresh => auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : "");

const navigationSections = [
  {
    label: "Overview",
    items: [
      { path: "/home", label: "Dashboard", icon: LayoutDashboard },
      { path: "/career", label: "Career intelligence", icon: TrendingUp },
      { path: "/help", label: "Help & support", icon: CircleHelp },
      { path: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    label: "Build skills",
    items: [
      { path: "/roadmap", label: "Learning path & roadmap", icon: GraduationCap },
      { path: "/certificates", label: "Certificates", icon: Award },
    ],
  },
  {
    label: "Get hired",
    items: [
      { path: "/resume", label: "Resume analyser", icon: FileText },
      { path: "/interview", label: "Mock interview", icon: MessageSquareText },
      { path: "/recommendations", label: "Job recommendations", icon: Sparkles },
      { path: "/jobs", label: "Job analyser", icon: BriefcaseBusiness },
      { path: "/drives", label: "Placement drives", icon: CalendarDays },
      { path: "/documents", label: "Documents", icon: FileText },
    ],
  },
];
const navigation = navigationSections.flatMap(section => section.items);

const AppContext = createContext(null);
const CAREER_INTELLIGENCE_CACHE_TTL_MS = 30_000;
const careerIntelligenceCache = new Map();

function invalidateCareerIntelligenceCache(userId) {
  for (const key of careerIntelligenceCache.keys()) {
    if (key.startsWith(`${userId}:`)) careerIntelligenceCache.delete(key);
  }
}

function useApp() {
  return useContext(AppContext);
}

function useResource(loader, dependencies = []) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const reload = useCallback(async () => {
    setState(previous => ({ ...previous, loading: true, error: "" }));
    try {
      const data = await loader();
      setState({ loading: false, error: "", data });
    } catch (error) {
      setState({ loading: false, error: error.message || "Unable to load this page.", data: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("careerInfinity:theme")
        || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch (error) {
      console.error("Unable to load theme preference.", error);
      return "light";
    }
  });
  const [toast, setToast] = useState("");

  const refreshSummary = useCallback(async () => {
    try {
      const value = await api("/dashboard/summary");
      if (user?.uid) invalidateCareerIntelligenceCache(user.uid);
      setSummary(value);
      setSummaryError("");
      return value;
    } catch (error) {
      setSummaryError(error.message);
      throw error;
    }
  }, [user?.uid]);

  useEffect(() => onAuthStateChanged(auth, current => {
    setUser(current);
    setAuthLoading(false);
    setTokenProvider(async forceRefresh => current ? current.getIdToken(forceRefresh) : "");
  }), []);
  useEffect(() => {
    if (user) refreshSummary().catch(() => {});
    else setSummary(null);
  }, [user, refreshSummary]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("careerInfinity:theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  if (authLoading) return <CenteredState label="Loading your career workspace..." />;
  if (!user) return <CenteredState label="Please sign in to continue." action={<a className="button-primary" href="/">Go to sign in</a>} />;

  return (
    <AppContext.Provider value={{
      user, summary, summaryError, refreshSummary,
      notify: message => setToast(message),
      theme, setTheme,
    }}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/resume" replace />} />
          <Route path="home" element={<DashboardPage />} />
          <Route path="career" element={<CareerIntelligencePage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="skills" element={<Navigate to="/roadmap" replace />} />
          <Route path="resume" element={<ResumeAnalyzerPage />} />
          <Route path="jobs" element={<JobAnalyzerPage />} />
          <Route path="interview" element={<MockInterviewPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="drives" element={<PlacementDrivesPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="certificates" element={<CertificatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/resume" replace />} />
        </Route>
      </Routes>
      {toast && <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl" role="status">{toast}</div>}
    </AppContext.Provider>
  );
}

function CenteredState({ label, action }) {
  return <div className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="text-center"><LoaderCircle className="mx-auto mb-4 animate-spin text-violet" size={28}/><p className="text-sm text-slate-600">{label}</p>{action && <div className="mt-4">{action}</div>}</div></div>;
}

function AppLayout() {
  const { user, theme, setTheme, notify } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const current = navigation.find(item => location.pathname.startsWith(item.path)) || navigation[3];
  const initials = (user.displayName || user.email || "C").slice(0, 1).toUpperCase();
  const logout = async () => {
    await signOut(auth);
    window.location.assign("/");
  };
  const toggleTheme = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      await api("/settings", jsonRequest("PATCH", { theme: nextTheme }));
    } catch (error) {
      setTheme(theme);
      notify(`Unable to save theme preference: ${error.message}`);
    }
  };
  return (
    <div className={`app-shell min-h-screen text-ink ${location.pathname.startsWith("/career") ? "career-intelligence-shell" : ""}`}>
      {mobileOpen && <button className="mobile-overlay fixed inset-0 z-30 md:hidden" aria-label="Close menu" onClick={() => setMobileOpen(false)}/>}
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col px-4 py-5 text-slate-100 shadow-xl transition-all md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "md:w-[86px]" : "md:w-[270px]"}`}>
        <div className="sidebar-brand mb-7 flex items-center justify-between px-2">
          <Link to="/resume" className={`flex items-center gap-3 ${collapsed ? "md:justify-center" : ""}`}>
            <span className="brand-mark grid h-10 w-10 shrink-0 place-items-center rounded-xl font-extrabold">CI</span>
            <span className={collapsed ? "md:hidden" : ""}><strong className="block text-[15px]">CareerInfinity</strong><small className="text-xs text-slate-400">AI Powered</small></span>
          </Link>
          <button className="hidden rounded-lg p-2 text-slate-400 hover:bg-white/10 md:block" onClick={() => setCollapsed(value => !value)} aria-label="Collapse sidebar"><ChevronLeft size={17} className={collapsed ? "rotate-180" : ""}/></button>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close sidebar"><X size={18}/></button>
        </div>
        <nav className="sidebar-nav flex-1 space-y-3 overflow-y-auto" aria-label="Main navigation">
          {navigationSections.map(section => <div className="nav-section" key={section.label}>
            <h2 className={`nav-section-title mb-1 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400 ${collapsed ? "md:hidden" : ""}`}>{section.label}</h2>
            <div className="nav-section-items space-y-1">
              {section.items.map(({ path, label, icon: Icon }) => {
                const active = location.pathname.startsWith(path);
                return <Link key={path} to={path} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}
                  className={`nav-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition ${active ? "bg-[#6658c9] text-white shadow-lg shadow-indigo-950/25" : "text-slate-300 hover:bg-white/[.07] hover:text-white"} ${collapsed ? "md:justify-center md:px-0" : ""}`}>
                  <Icon size={18} strokeWidth={1.8} className="shrink-0"/><span className={collapsed ? "md:hidden" : ""}>{label}</span>
                </Link>;
              })}
            </div>
          </div>)}
        </nav>
        <div className={`sidebar-profile mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-3 ${collapsed ? "md:justify-center md:px-1" : ""}`}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-400 font-bold text-white">{initials}</div>
          <div className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}><strong className="block truncate text-xs">{user.displayName || "CareerInfinity user"}</strong><span className="block truncate text-[10px] text-slate-400">{user.email}</span></div>
          <button onClick={logout} title="Log out" className={`rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white ${collapsed ? "md:hidden" : ""}`}><LogOut size={16}/></button>
        </div>
      </aside>
      <div className={`app-content min-h-screen transition-[padding] md:pl-[270px] ${collapsed ? "md:pl-[86px]" : ""}`}>
        <header className="sticky top-0 z-20 flex h-[78px] items-center justify-between border-b border-slate-100 bg-white/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl border border-slate-200 p-2 md:hidden" aria-label="Open menu"><Menu size={19}/></button>
            <div><div className="text-[10px] font-semibold uppercase tracking-[.17em] text-slate-400">CareerInfinity workspace</div><h1 className="mt-1 text-[17px] font-bold text-slate-800">{current.label}</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-xs text-slate-500 sm:block">{user.displayName || user.email}</span>
            <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} aria-pressed={theme === "dark"} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><Moon size={17}/></button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">{initials}</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-7 md:px-8 md:py-9"><Outlet/></main>
      </div>
    </div>
  );
}

function PageTitle({ eyebrow = "CAREER WORKSPACE", title, subtitle, action }) {
  return <div className="page-title mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-violet-600">{eyebrow}</p><h2 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-[28px]">{title}</h2>{subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>}</div>{action}</div>;
}

function Card({ children, className = "" }) {
  return <section className={`glass-card rounded-2xl border border-slate-100 bg-white p-5 shadow-soft md:p-6 ${className}`}>{children}</section>;
}

function Button({ children, className = "", variant = "primary", ...props }) {
  const styles = variant === "primary" ? "bg-violet-600 text-white shadow-lg shadow-violet-200 hover:bg-violet-700" : variant === "danger" ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return <button className={`ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`} {...props}>{children}</button>;
}

function TextInput({ label, className = "", ...props }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-slate-600">{label}<input className={`h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 ${className}`} {...props}/></label>;
}

function SelectInput({ label, options, className = "", ...props }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-slate-600">{label}<select className={`h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 ${className}`} {...props}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function TextArea({ label, className = "", ...props }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-slate-600">{label}<textarea className={`w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal text-slate-800 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 ${className}`} {...props}/></label>;
}

function ErrorState({ message, onRetry }) {
  const sessionExpired = /sign-in session is invalid or expired|please sign in again/i.test(message || "");
  const signInAgain = async () => {
    try {
      await signOut(auth);
    } finally {
      window.location.assign("/");
    }
  };
  return <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700" role="alert"><div className="flex flex-wrap items-start justify-between gap-3"><span>{message}</span><div className="flex shrink-0 items-center gap-4">{sessionExpired && <button type="button" onClick={signInAgain} className="font-semibold underline">Sign in again</button>}{onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>}</div></div></div>;
}

function EmptyState({ icon: Icon = FileText, title, description, action }) {
  return <div className="empty-state grid min-h-48 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-7 text-center"><div><span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Icon size={22}/></span><h3 className="text-sm font-bold text-slate-800">{title}</h3><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>{action && <div className="mt-4">{action}</div>}</div></div>;
}

function StatCard({ label, value, note, icon: Icon, tone = "violet" }) {
  const colors = { violet: "bg-violet-50 text-violet-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", blue: "bg-blue-50 text-blue-600" };
  return <Card className="stat-card p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-500">{label}</p><div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">{value}</div><p className="mt-1 text-[11px] text-slate-400">{note}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}><Icon size={19}/></span></div></Card>;
}

function ScoreGauge({ score = 0, label = "Resume score", estimated = false }) {
  const value = Math.max(0, Math.min(estimated ? 99 : 100, Number(score) || 0));
  const color = value >= 80 ? "#16a37a" : value >= 55 ? "#e59a30" : "#e25c67";
  const circumference = 2 * Math.PI * 43;
  return <div className="relative mx-auto h-36 w-36"><svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${value} out of 100 ${label}`}><circle cx="50" cy="50" r="43" fill="none" stroke="var(--line)" strokeWidth="8"/><circle cx="50" cy="50" r="43" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} className="transition-all duration-700"/></svg><div className="absolute inset-0 grid place-content-center text-center"><strong className="text-3xl font-extrabold text-slate-900">{value}<span className="text-sm text-slate-400">/100</span></strong><span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{value >= 80 ? "Strong signal" : value >= 55 ? "Developing" : "Needs work"}</span></div></div>;
}

function ProgressBar({ label, score, detail, estimated = false }) {
  const value = Math.max(0, Math.min(estimated ? 99 : 100, Number(score) || 0));
  const color = value >= 75 ? "bg-emerald-500" : value >= 45 ? "bg-amber-400" : "bg-rose-400";
  return <div className="mb-4"><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-700">{label}</span><span className="font-bold tabular-nums text-slate-700">{value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }}/></div>{detail && <p className="mt-1 text-[10px] leading-4 text-slate-400">{detail}</p>}</div>;
}

function SkillChip({ children, tone = "neutral" }) {
  const tones = { matched: "bg-emerald-50 text-emerald-700 ring-emerald-100", missing: "bg-rose-50 text-rose-700 ring-rose-100", weak: "bg-amber-50 text-amber-700 ring-amber-100", neutral: "bg-slate-100 text-slate-600 ring-slate-200" };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

function JourneyStep({ icon: Icon, label, status, last = false }) {
  return <div className={`journey-step journey-step-${status}${last ? " journey-step-last" : ""}`}>
    <span className="journey-step-marker" aria-hidden="true">{status === "done" ? <Check size={16}/> : <Icon size={16}/>}</span>
    <span className="journey-step-label">{label}</span>
    <span className="journey-step-status">{status === "done" ? "Done" : status === "current" ? "Up next" : "Upcoming"}</span>
  </div>;
}

function Loading({ label = "Loading..." }) {
  return <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin"/>{label}</div>;
}

function DashboardPage() {
  const { summary, summaryError, refreshSummary } = useApp();
  const analysis = summary?.analysis?.data;
  const roleMatches = summary?.role_matches?.roles || [];
  const skills = summary?.detected_skills || [];
  const roadmap = summary?.roadmap_progress;
  const completedResources = roadmap?.completed_resources || 0;
  const roadmapPercent = roadmap ? Math.max(0, Math.min(100, Number(roadmap.overall_percent) || 0)) : null;
  const hasResume = Boolean(summary?.document || analysis);
  const hasReviewedSkills = hasResume && skills.length > 0;
  const hasPractisedInterview = summary?.recent_activity?.some(item => item.title.startsWith("Mock interview")) || false;
  const completed = [hasResume, hasReviewedSkills, roadmapPercent === 100, hasPractisedInterview, false];
  const currentStepIndex = completed.findIndex(done => !done);
  const stepActions = [
    { to: "/resume", label: "Upload and analyse", title: "Start with your resume", copy: "Upload a resume to discover your strongest skills and career matches." },
    { to: "/career", label: "Review your skills", title: "Review your skill signals", copy: "See which strengths and gaps shape your best-fit career matches." },
    { to: "/roadmap", label: "Resume learning", title: "Build skills for your target role", copy: "Pick up your learning path and track progress as you complete resources." },
    { to: "/interview", label: "Practise an interview", title: "Practise before your next interview", copy: "Run through a role-based mock interview and review your feedback." },
    { to: "/drives", label: "Explore placement drives", title: "Find your next opportunity", copy: "Review current openings, check eligibility, and save drives that fit." },
  ];
  const currentStep = stepActions[Math.max(0, currentStepIndex)];
  const bestMatch = roleMatches[0];
  const bestMatchScore = Math.min(99, Math.max(0, Number(bestMatch?.match_score) || 0));
  const nextPathPercent = Math.round((completed.filter(Boolean).length / completed.length) * 100);
  return <>
    <PageTitle title="Welcome back" subtitle="A clear view of your next steps, growing skills, and opportunities." action={<Button onClick={refreshSummary}><Activity size={15}/>Refresh overview</Button>}/>
    {summaryError && <ErrorState message={summaryError} onRetry={refreshSummary}/>}
    <Card className="journey-card mb-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-violet-600">Your career journey</p><h3 className="text-lg font-bold text-slate-900">Your path to a job</h3></div>
        <span className="text-xs font-semibold text-slate-500">{nextPathPercent}% of milestones complete</span>
      </div>
      <div className="journey-steps" style={{ "--journey-progress": `${nextPathPercent}%` }}>
        {[
          { label: "Upload resume", icon: Upload },
          { label: "Review skills", icon: BarChart3 },
          { label: "Learn", icon: GraduationCap },
          { label: "Practise interviews", icon: MessageSquareText },
          { label: "Apply", icon: BriefcaseBusiness },
        ].map((step, index) => <JourneyStep key={step.label} {...step} status={completed[index] ? "done" : index === currentStepIndex ? "current" : "upcoming"} last={index === completed.length - 1}/>)}
      </div>
    </Card>
    <div className="mb-5 grid gap-4 md:grid-cols-3">
      <Card className="dashboard-stat dashboard-match">
        <div><p className="text-xs font-semibold text-slate-500">Best career match</p><h3 className="mt-2 text-base font-bold text-slate-900">{bestMatch?.role || "Explore your fit"}</h3><p className="mt-1 text-[11px] text-slate-500">{bestMatch ? "Based on resume skill keywords" : "Analyse a resume to see role matches"}</p></div>
        <div className="match-ring" style={{ "--match-score": `${bestMatch ? bestMatchScore : 0}%` }} aria-label={bestMatch ? `${bestMatchScore}% estimated match` : "No career match yet"}><span>{bestMatch ? `${bestMatchScore}%` : "—"}</span></div>
        {bestMatch && <Link className="dashboard-stat-link" to="/career">Explore career matches <ArrowRight size={14}/></Link>}
      </Card>
      <StatCard label="Skills detected" value={skills.length || "—"} note={skills.length ? "Found in your latest resume" : "Upload and analyse your resume"} icon={Sparkles} tone="green"/>
      <Card className="dashboard-stat">
        <div><p className="text-xs font-semibold text-slate-500">Learning progress</p><div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">{roadmapPercent === null ? "—" : `${roadmapPercent}%`}</div><p className="mt-1 text-[11px] text-slate-500">{roadmap ? `${completedResources} of ${roadmap.total_resources} resources complete` : "Choose a path to start learning"}</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><GraduationCap size={19}/></span>
        {roadmap && <div className="learning-meter" role="progressbar" aria-label="Learning progress" aria-valuenow={roadmapPercent} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${roadmapPercent}%` }}/></div>}
      </Card>
    </div>
    <section className="next-step-banner mb-5 flex flex-col gap-5 rounded-3xl p-6 md:flex-row md:items-center md:justify-between md:p-8">
      <div className="max-w-2xl"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-white/75">Your next step</p><h3 className="text-xl font-bold text-white">{currentStep.title}</h3><p className="mt-2 text-sm leading-6 text-white/85">{currentStep.copy}</p></div>
      <Link to={currentStep.to} className="next-step-action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">{currentStep.label}<ArrowRight size={16}/></Link>
    </section>
    <div className="mb-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Top career matches</h3><p className="mt-1 text-xs text-slate-500">Keyword-based estimates, not hiring decisions</p></div><Link to="/career" className="text-xs font-semibold text-violet-700">View all</Link></div>
        {roleMatches.length ? <div>{roleMatches.slice(0, 5).map((role, index) => <Link key={role.role} to={`/roadmap?role=${encodeURIComponent(role.role)}`} className="match-row block rounded-xl px-3 pt-3 transition">
          <ProgressBar label={`${index + 1}. ${role.role}`} score={role.match_score} detail={role.why_this_role_fits} estimated/>
        </Link>)}</div> : <EmptyState icon={Target} title="Your career matches will appear here" description="Upload and analyse your resume to see roles that fit your skills." action={<Link className="text-xs font-semibold text-violet-700" to="/resume">Upload and analyse</Link>}/>}
      </Card>
      <Card>
        <div className="mb-4"><h3 className="font-bold text-slate-900">Skills found</h3><p className="mt-1 text-xs text-slate-500">Keywords detected in your latest resume</p></div>
        {skills.length ? <div className="flex flex-wrap gap-2">{skills.slice(0, 24).map(skill => <SkillChip key={skill} tone="matched">{skill}</SkillChip>)}</div> : <EmptyState icon={Sparkles} title="No skills detected yet" description="Add a resume to see the skill keywords identified by the analyser." action={<Link className="text-xs font-semibold text-violet-700" to="/resume">Upload your resume</Link>}/>}
      </Card>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">Quick actions</h3><p className="mt-1 text-xs text-slate-500">Pick up where you left off</p></div><Sparkles className="text-violet-500" size={20}/></div><div className="grid gap-3 sm:grid-cols-3">
        <Link to="/resume" className="glass-tile group rounded-2xl bg-violet-50 p-4 transition"><FileText className="mb-5 text-violet-600" size={19}/><strong className="block text-sm">Resume analyser</strong><span className="mt-1 block text-xs text-slate-500">Find skill signals and role matches</span></Link>
        <Link to="/interview" className="glass-tile group rounded-2xl bg-blue-50 p-4 transition"><MessageSquareText className="mb-5 text-blue-600" size={19}/><strong className="block text-sm">Practise interviews</strong><span className="mt-1 block text-xs text-slate-500">Get feedback on role-based answers</span></Link>
        <Link to="/drives" className="glass-tile group rounded-2xl bg-emerald-50 p-4 transition"><CalendarDays className="mb-5 text-emerald-600" size={19}/><strong className="block text-sm">Find opportunities</strong><span className="mt-1 block text-xs text-slate-500">Explore placement drives</span></Link>
      </div></Card>
      <Card><h3 className="font-bold">Recent activity</h3><p className="mb-4 mt-1 text-xs text-slate-500">Your latest CareerInfinity actions</p>{summary?.recent_activity?.length ? <div className="space-y-4">{summary.recent_activity.map((item, index) => <div key={`${item.title}-${index}`} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Activity size={15}/></span><div><strong className="block text-xs text-slate-700">{item.title}</strong><span className="text-[10px] text-slate-500">{new Date(item.date).toLocaleString()}</span></div></div>)}</div> : <EmptyState icon={Activity} title="Your activity will appear here" description="Analyse your resume or start a mock interview to get going."/ >}</Card>
    </div>
  </>;
}

function useRoleMatches() {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const { user } = useApp();
  const cacheKey = `${user.uid}:career-intelligence`;
  const reload = useCallback(async () => {
    const cached = careerIntelligenceCache.get(cacheKey);
    if (cached?.data && Date.now() - cached.cachedAt < CAREER_INTELLIGENCE_CACHE_TTL_MS) {
      careerIntelligenceCache.delete(cacheKey);
      careerIntelligenceCache.set(cacheKey, cached);
      setState({ loading: false, error: "", data: cached.data });
      return;
    }
    setState({ loading: true, error: "", data: null });
    if (cached?.promise) {
      try {
        const data = await cached.promise;
        setState({ loading: false, error: "", data });
      } catch (error) {
        setState({ loading: false, error: error.message, data: null });
      }
      return;
    }
    if (cached) careerIntelligenceCache.delete(cacheKey);
    try {
      const request = api("/career/intelligence").then(data => {
        careerIntelligenceCache.set(cacheKey, { cachedAt: Date.now(), data });
        return data;
      }).catch(error => {
        if (careerIntelligenceCache.get(cacheKey)?.promise === request) {
          careerIntelligenceCache.delete(cacheKey);
        }
        throw error;
      });
      careerIntelligenceCache.set(cacheKey, { promise: request });
      const data = await request;
      if (careerIntelligenceCache.size > 16) {
        careerIntelligenceCache.delete(careerIntelligenceCache.keys().next().value);
      }
      setState({ loading: false, error: "", data });
    } catch (error) {
      setState({ loading: false, error: error.message, data: null });
    }
  }, [cacheKey]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

function CareerIntelligenceSkeleton() {
  return <div className="space-y-5" role="status" aria-label="Loading career insights">
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <div className="career-skeleton h-64 rounded-2xl"/>
      <div className="career-skeleton h-64 rounded-2xl"/>
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map(item => <div key={item} className="career-skeleton h-36 rounded-2xl"/>)}
    </div>
    <div className="career-skeleton h-28 rounded-2xl"/>
  </div>;
}

function CareerIntelligencePage() {
  const { data, loading, error, reload } = useRoleMatches();
  const { notify } = useApp();
  const [role, setRole] = useState("");
  const marketRoles = useMemo(() => data?.market?.roles || [], [data?.market?.roles]);
  const roleOptions = useMemo(
    () => marketRoles.map(item => ({ value: item.title, label: item.title })),
    [marketRoles],
  );
  const selected = useMemo(
    () => marketRoles.find(item => item.title === (role || data?.roles?.[0]?.role)) || marketRoles[0],
    [marketRoles, role, data?.roles],
  );
  const chartData = useMemo(() => selected?.demand || [], [selected]);
  const visibleMatches = useMemo(() => data?.roles?.slice(0, 5) || [], [data?.roles]);
  const suggestion = data?.ai_suggestion || "Analyse your resume to get tailored career guidance.";
  return <>
    <div className="career-intelligence-page">
    <PageTitle title="Career intelligence" subtitle="Explore career matches, market context, and practical next steps." action={<SelectInput label="Market role" value={role || data?.roles?.[0]?.role || ""} onChange={event => setRole(event.target.value)} options={roleOptions}/>}/>
    {loading && !data && <CareerIntelligenceSkeleton/>}{error && <ErrorState message={error} onRetry={reload}/>}
    {data && <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card><div className="mb-5 flex items-center justify-between"><div><h3 className="font-bold">Career compatibility</h3><p className="mt-1 text-xs text-slate-400">{data.role_match_source === "saved_analysis_skill_signals" ? "Estimated from skills in your existing resume analysis" : "Role matches from your latest resume"}</p></div><BarChart3 size={19} className="text-violet-500"/></div>
          {visibleMatches.length ? visibleMatches.map((item, index) => <Link key={item.role} to={`/roadmap?role=${encodeURIComponent(item.role)}`} className="match-row block rounded-lg px-2 pt-2 transition"><ProgressBar label={`${index + 1}. ${item.role}`} score={item.match_score} detail={item.why_this_role_fits} estimated/></Link>) : <EmptyState icon={FileText} title="Analyse a resume first" description="Your top role compatibility estimates will show here." action={<Link className="text-xs font-semibold text-violet-700" to="/resume">Go to resume analyser</Link>}/> }
        </Card>
        <Card><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">Industry demand</h3><p className="mt-1 text-xs text-slate-400">{selected?.title || "Selected role"} · projected openings index</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{selected?.growth_badge || "Sample data"}</span></div>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--mute)" }}/><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--mute)" }}/><Tooltip contentStyle={{ background: "var(--panel-solid)", borderColor: "var(--edge)", borderRadius: 12, color: "var(--ink)" }}/><Bar dataKey="index" name="Demand index" fill="var(--brand)" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Expected salary" value={selected?.salary_lpa || "—"} note="India · annual range (sample)" icon={BriefcaseBusiness} tone="green"/>
        <StatCard label="Job opportunities" value={selected?.job_count_label || "—"} note="India · sample placeholder count" icon={Users} tone="blue"/>
        <StatCard label="Growth rate" value={selected?.growth_rate || "—"} note="Market data classification" icon={TrendingUp} tone="amber"/>
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 p-5 md:flex-row md:items-center md:justify-between"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-violet-600 shadow-sm"><Lightbulb size={21}/></span><div><h3 className="text-sm font-bold">AI suggestion</h3><p className="mt-1 text-sm leading-6 text-slate-600">{suggestion}</p><p className="mt-1 text-[10px] text-slate-400">Suggestion: {data.ai_suggestion_source || "skill-gap based"} · market source: {data.market?.source} · last updated {data.market?.last_updated} · illustrative sample values.</p></div></div><Link to="/roadmap" className="button-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold text-white">Explore learning path <ArrowRight size={15}/></Link></div>
    </div>}
    </div>
  </>;
}

function RoadmapResource({ resource, onStatusChange, onDetailsSave, onProofUpload, onProofDownload }) {
  const [notes, setNotes] = useState(resource.progress?.notes || "");
  const [proofUrl, setProofUrl] = useState(resource.progress?.proof_url || "");
  useEffect(() => {
    setNotes(resource.progress?.notes || "");
    setProofUrl(resource.progress?.proof_url || "");
  }, [resource.progress?.notes, resource.progress?.proof_url]);
  const certification = resource.type === "certification";
  return <article className="rounded-xl border border-slate-100 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm text-slate-800">{resource.title}</strong>
          {certification && <span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-bold uppercase text-violet-700">Certification</span>}
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold capitalize text-slate-600">{resource.level}</span>
          <span className={`rounded-full px-2 py-1 text-[9px] font-semibold capitalize ${resource.cost === "free" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{resource.cost}</span>
          {resource.progress?.verified && <SkillChip tone="matched"><Check size={11}/>Proof added</SkillChip>}
        </div>
        <p className="mt-1 text-[10px] text-slate-400">{resource.provider} · {resource.estimated_hours} hours{resource.needs_verification ? " · link needs verification" : ""}</p>
        <a href={resource.url} target="_blank" rel="noopener noreferrer" aria-label={`${certification ? "Open certification" : "Start course"}: ${resource.title} at ${resource.provider} (opens in a new tab)`} className="button-primary mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-violet-500">
          {certification ? "Open certification" : "Start course"}<ArrowRight size={14}/>
        </a>
      </div>
      <label className="text-[10px] font-semibold text-slate-500">Progress
        <select value={resource.progress?.status || "not_started"} onChange={event => onStatusChange(resource.id, event.target.value)} className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-700">
          <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
        </select>
      </label>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
      <input value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} placeholder="Add a note or completion detail" className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-violet-400"/>
      <Button variant="secondary" onClick={() => onDetailsSave(resource.id, { notes, proof_url: proofUrl, status: resource.progress?.status || "not_started" })}>Save details</Button>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input value={proofUrl} onChange={event => setProofUrl(event.target.value)} placeholder="Credential or proof URL (optional)" className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-violet-400"/>
      {resource.progress?.proof_download_url && <button className="text-xs font-semibold text-violet-700" onClick={() => onProofDownload(resource.id, resource.progress.proof_filename)}>Download proof: {resource.progress.proof_filename}</button>}
      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50">Add proof file<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={event => onProofUpload(resource.id, event.target.files?.[0])}/></label>
    </div>
    {resource.progress?.verified && <p className="mt-2 text-[10px] text-emerald-700">Completion proof is recorded. Issuer verification is not performed automatically.</p>}
  </article>;
}

function RoadmapPage() {
  const { summary, refreshSummary, notify } = useApp();
  const location = useLocation();
  const requestedRole = new URLSearchParams(location.search).get("role") || "";
  const roleAliases = {
    "QA Engineer": "SDET / QA Automation Engineer",
    "MLOps Engineer": "MLOps / LLMOps Engineer",
    "Business Intelligence Analyst": "Business Intelligence (BI) Analyst",
    "Product Manager": "Technical Product Manager",
  };
  const initialRole = roleAliases[requestedRole] || requestedRole;
  const [role, setRole] = useState(initialRole);
  const [search, setSearch] = useState("");
  const [weeklyHours, setWeeklyHours] = useState(5);
  const catalog = useResource(() => api("/roadmaps"), []);
  const selectedRole = catalog.data?.roles?.find(item => item.title === role) || catalog.data?.roles?.[0];
  const roleTitle = selectedRole?.title || "";
  const slug = roleTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const roadmap = useResource(
    () => slug ? api(`/roadmaps/${slug}/progress?weekly_study_hours=${weeklyHours}`) : Promise.resolve(null),
    [slug, weeklyHours],
  );
  const filteredRoles = (catalog.data?.roles || []).filter(item =>
    `${item.title} ${item.group}`.toLowerCase().includes(search.toLowerCase()),
  );
  useEffect(() => {
    if (!role && selectedRole) setRole(selectedRole.title);
  }, [role, selectedRole]);

  const saveProgress = async (resourceId, payload) => {
    try {
      await api(`/progress/${resourceId}`, jsonRequest("PATCH", payload));
      await roadmap.reload();
      await refreshSummary();
      notify("Roadmap progress saved.");
    } catch (failure) { notify(`Unable to save roadmap progress: ${failure.message}`); }
  };
  const uploadProof = async (resourceId, file) => {
    if (!file) return;
    const form = new FormData();
    form.append("proof", file);
    try {
      await api(`/progress/${resourceId}/proof`, { method: "POST", body: form });
      await roadmap.reload();
      await refreshSummary();
      notify("Completion proof uploaded.");
    } catch (failure) { notify(`Unable to upload proof: ${failure.message}`); }
  };
  const downloadProof = async (resourceId, filename) => {
    try {
      const response = await api(`/progress/${resourceId}/proof`, { raw: true });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "roadmap-proof";
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) { notify(`Unable to download proof: ${failure.message}`); }
  };
  const resumeSkills = new Set((summary?.detected_skills || []).map(skill => skill.toLowerCase()));
  const verifiedSkills = new Set((roadmap.data?.verified_skills || []).map(skill => skill.toLowerCase()));

  return <>
    <PageTitle title="Roadmap" subtitle="Choose a career path, follow stage-matched courses, and track your progress and credentials."/>
    <Card className="mb-5">
      <div className="grid gap-4 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
        <label className="block text-xs font-semibold text-slate-600">Search roles<input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Search title or category" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-400"/></label>
        <label className="block text-xs font-semibold text-slate-600">Role catalog
          <select value={selectedRole?.title || ""} onChange={event => setRole(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-violet-400">
            {(catalog.data?.groups || []).map(group => <optgroup key={group} label={group}>{filteredRoles.filter(item => item.group === group).map(item => <option key={item.title} value={item.title}>{item.priority ? "★ Priority · " : ""}{item.title}</option>)}</optgroup>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600">Study hours / week<input type="number" min="1" max="80" value={weeklyHours} onChange={event => setWeeklyHours(Math.min(80, Math.max(1, Number(event.target.value) || 1)))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-400"/></label>
      </div>
      {catalog.error && <div className="mt-4"><ErrorState message={catalog.error} onRetry={catalog.reload}/></div>}
      {selectedRole && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-slate-800">{selectedRole.title}</span><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-700">{selectedRole.group}</span>{selectedRole.priority && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">Priority</span>}{selectedRole.status === "basic" && <span className="text-xs text-slate-500">More detail coming soon.</span>}</div>}
    </Card>
    {catalog.loading && <Loading label="Loading the role catalog..."/>}
    {roadmap.loading && <Loading label="Loading roadmap progress..."/>}{roadmap.error && <ErrorState message={roadmap.error} onRetry={roadmap.reload}/>}
    {roadmap.data && <div className="space-y-5">
      <Card className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
        <ScoreGauge score={roadmap.data.overall_percent} label="Roadmap progress"/>
        <div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Learning destination</p><h3 className="mt-1 text-xl font-extrabold text-slate-900">{roadmap.data.role}</h3><p className="mt-1 text-sm text-slate-500">{roadmap.data.description}</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><StatCard label="Study hours" value={`${roadmap.data.hours_done} / ${roadmap.data.hours_done + roadmap.data.hours_remaining}`} note="Completed / total" icon={GraduationCap} tone="violet"/><StatCard label="Resources" value={`${roadmap.data.completed_resources} / ${roadmap.data.total_resources}`} note="Completed" icon={Check} tone="green"/><StatCard label="Estimated finish" value={roadmap.data.estimated_finish_date || "—"} note={`${weeklyHours} hours per week`} icon={CalendarDays} tone="blue"/></div></div>
      </Card>
      {roadmap.data.current_stage && <Card className="border-l-4 border-l-violet-500 bg-violet-50/60"><p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Your next step</p><h3 className="mt-1 font-bold text-slate-800">{roadmap.data.current_stage.title}</h3><p className="mt-1 text-xs text-slate-500">Complete this stage’s resources to move forward. Estimated study time remaining in stage: {roadmap.data.current_stage.hours_remaining} hours.</p></Card>}
      {roadmap.data.stages.map((stage, index) => <Card key={stage.id} className={stage.id === roadmap.data.current_stage?.stage_id ? "border-violet-200 ring-1 ring-violet-100" : ""}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-700"><GraduationCap size={18}/></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Stage {index + 1} · {stage.estimated_weeks} weeks</p><h3 className="font-bold">{stage.title}{stage.id === roadmap.data.current_stage?.stage_id && <span className="ml-2 rounded-full bg-violet-100 px-2 py-1 text-[9px] text-violet-700">Current</span>}</h3></div></div><span className="text-xs font-bold text-slate-600">{stage.progress.progress_percent}% complete</span></div>
        <div className="mt-4"><ProgressBar label={`${stage.progress.completed_resources} of ${stage.progress.total_resources} resources · ${stage.progress.hours_done}h done · ${stage.progress.hours_remaining}h left`} score={stage.progress.progress_percent}/></div>
        <div className="mt-4"><h4 className="mb-2 text-xs font-bold text-slate-700">Skills</h4><div className="flex flex-wrap gap-2">{stage.skills.map(skill => {
          const verified = verifiedSkills.has(skill.toLowerCase());
          const detected = resumeSkills.has(skill.toLowerCase());
          return <span key={skill} className="relative"><SkillChip tone={detected || verified ? "matched" : "missing"}>{skill}</SkillChip>{verified && <span className="ml-1 align-middle text-[9px] font-bold text-emerald-700">Verified</span>}</span>;
        })}</div></div>
        <div className="mt-4"><h4 className="mb-2 text-xs font-bold text-slate-700">Courses and credentials for this stage</h4><div className="space-y-3">{stage.resources.map(resource => <RoadmapResource key={resource.id} resource={resource} onStatusChange={(id, status) => saveProgress(id, { status })} onDetailsSave={saveProgress} onProofUpload={uploadProof} onProofDownload={downloadProof}/>)}</div></div>
        {stage.projects?.length > 0 && <div className="mt-4 rounded-xl bg-slate-50 p-4"><h4 className="text-xs font-bold text-slate-700">Portfolio projects</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">{stage.projects.map(project => <li key={project}>{project}</li>)}</ul><p className="mt-3 text-xs"><strong>Milestone:</strong> {stage.milestone}</p></div>}
      </Card>)}
      <p className="px-1 text-[10px] leading-5 text-slate-400">A “Verified” skill means a completed learning resource has proof attached; the app does not independently validate issuers or credential records. Resources marked “link needs verification” should be checked before use.</p>
    </div>}
  </>;
}

function ResumeAnalyzerPage() {
  const { summary, refreshSummary, notify } = useApp();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localAnalysis, setLocalAnalysis] = useState(null);
  const [roleMatches, setRoleMatches] = useState(null);
  const analysis = localAnalysis || summary?.analysis?.data;
  const choose = candidate => {
    if (!candidate) return;
    if (!/\.(pdf|docx)$/i.test(candidate.name)) return setError("Choose a PDF or DOCX resume.");
    if (candidate.size > 5 * 1024 * 1024) return setError("Maximum resume size is 5 MB.");
    setError(""); setFile(candidate); setLocalAnalysis(null); setRoleMatches(null);
  };
  const analyze = async () => {
    if (!file) return setError("Choose your resume file first.");
    setLoading(true); setError("");
    try {
      const form = new FormData(); form.append("resume", file);
      const result = await api("/resume/analyze", { method: "POST", body: form });
      setLocalAnalysis(result.analysis || result.data || result);
      setRoleMatches(result.role_matching || null);
      // The upload is already saved if this later dashboard refresh fails.
      // Keep its successful analysis visible instead of reporting a false upload error.
      try { await refreshSummary(); } catch { /* Summary can refresh on the next visit. */ }
      notify("Resume analyzed successfully.");
    } catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  };
  return <>
    <PageTitle title="Resume analyser" subtitle="Upload your resume for keyword-based estimates, role matches, and tailored recommendations."/>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className="space-y-5">
        <Card>
          <h3 className="font-bold">Upload your resume</h3><p className="mb-4 mt-1 text-xs text-slate-400">Your PDF/DOCX is parsed by the existing CareerInfinity analyzer.</p>
          <label onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}
            className={`grid min-h-48 cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-violet-500 bg-violet-50" : "border-violet-200 bg-violet-50/40 hover:bg-violet-50"}`}>
            <div><span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm"><CloudUpload size={23}/></span><strong className="block text-sm text-slate-800">{file ? file.name : "Drop your resume here"}</strong><span className="mt-1 block text-xs text-slate-500">or <span className="font-bold text-violet-700">Browse Files</span></span><span className="mt-3 block text-[10px] text-slate-400">Supported: PDF, DOCX · Maximum 5 MB</span></div>
            <input type="file" accept=".pdf,.docx" className="hidden" onChange={event => { choose(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
          </label>
          {error && <div className="mt-3"><ErrorState message={error}/></div>}
          <div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={analyze} disabled={!file || loading}>{loading ? <LoaderCircle size={16} className="animate-spin"/> : <Sparkles size={16}/>}Upload and analyse</Button><span className="text-[11px] text-slate-500">Estimates use resume keywords and are not hiring decisions.</span></div>
          {loading && <div className="mt-5 animate-pulse space-y-3"><div className="h-3 w-1/3 rounded bg-slate-100"/><div className="h-20 rounded-xl bg-slate-100"/><div className="h-3 w-2/3 rounded bg-slate-100"/></div>}
        </Card>
        {analysis && <Card><h3 className="mb-1 font-bold">Score breakdown</h3><p className="mb-4 text-xs text-slate-500">Keyword-based estimates to help prioritise edits.</p><div className="space-y-4">{Object.entries(analysis.resume_breakdown || {}).map(([key,value]) => <ProgressBar key={key} label={key.replaceAll("_"," ").replace(/\b\w/g,char => char.toUpperCase())} score={value} detail={analysis.resume_explanations?.[key]} estimated/>)}</div></Card>}
      </div>
      <div className="space-y-5">
        <Card><div className="mb-2 flex items-center justify-between"><div><h3 className="font-bold">Resume score</h3><p className="mt-1 text-xs text-slate-400">Overall structure and keyword signals</p></div>{Number(analysis?.resume_score) >= 80 && <Trophy className="text-amber-500" size={20}/>}</div>
          {analysis ? <><ScoreGauge score={analysis.resume_score} estimated/><p className="text-center text-xs text-slate-500">{analysis.disclaimer || "Keyword-based estimate only; this is not a hiring decision."}</p></> : <EmptyState icon={FileText} title="Your score will appear here" description="Upload and analyse a resume to see keyword-based estimates."/ >}
        </Card>
        <Card><h3 className="font-bold">AI suggestions</h3><p className="mb-4 mt-1 text-xs text-slate-400">Improvement opportunities detected in your resume</p>{analysis?.suggestions?.length ? <ul className="space-y-3">{analysis.suggestions.map((suggestion,index) => <li key={`${suggestion}-${index}`} className="flex gap-2 text-xs leading-5 text-slate-600"><Check className="mt-0.5 shrink-0 text-emerald-500" size={15}/>{suggestion}</li>)}</ul> : <p className="text-xs text-slate-400">Upload your resume to generate tailored suggestions.</p>}</Card>
        {roleMatches?.roles?.length > 0 && <Card><div className="mb-4 flex items-center justify-between"><h3 className="font-bold">Best-fit job roles</h3><Link to="/career" className="text-xs font-semibold text-violet-700">Explore all</Link></div>{roleMatches.roles.slice(0,3).map(role => <ProgressBar key={role.role} label={role.role} score={role.match_score} estimated/>)}</Card>}
        {analysis?.skills?.length > 0 && <Card><h3 className="mb-3 font-bold">Detected skills</h3><div className="flex flex-wrap gap-2">{analysis.skills.map(skill => <SkillChip key={skill.name} tone={skill.level === "Strong" ? "matched" : skill.level === "Intermediate" ? "weak" : "neutral"}>{skill.name}</SkillChip>)}</div></Card>}
      </div>
    </div>
  </>;
}

function JobAnalyzerPage() {
  const { notify } = useApp();
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const analyze = async event => {
    event.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await api("/jobs/analyze", jsonRequest("POST", { job_description: description }));
      setResult(data); notify("Job description compared with your latest resume.");
    } catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  };
  return <>
    <PageTitle title="Job analyser" subtitle="Compare a job description with your analysed resume and identify aligned skills and gaps."/>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card><form onSubmit={analyze} className="space-y-4"><TextArea label="Paste job description" rows={14} required minLength={40} maxLength={15000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Paste the responsibilities and requirements from the job post..."/>{error && <ErrorState message={error}/>}<Button disabled={loading || description.trim().length < 40}>{loading && <LoaderCircle className="animate-spin" size={16}/>}Compare job description</Button></form></Card>
      <Card><h3 className="mb-4 font-bold">Your match report</h3>{loading ? <Loading label="Comparing skills..."/> : result ? <><ScoreGauge score={result.match_score} label="job match" estimated/><p className="text-center text-xs text-slate-500">Keyword-based estimate, not a hiring decision.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><h4 className="mb-2 text-xs font-bold text-emerald-700">Matched keywords</h4><div className="flex flex-wrap gap-2">{result.matched_skills?.map(skill => <SkillChip key={skill} tone="matched">{skill}</SkillChip>)}</div></div><div><h4 className="mb-2 text-xs font-bold text-rose-700">Skills to develop</h4><div className="flex flex-wrap gap-2">{result.missing_skills?.map(skill => <SkillChip key={skill} tone="missing">{skill}</SkillChip>)}</div></div></div><p className="mt-4 text-xs text-slate-500">{result.summary}</p></> : <EmptyState icon={BriefcaseBusiness} title="Ready when you are" description="Analyse a resume first, then paste a job description to compare your skill signals."/ >}</Card>
    </div>
  </>;
}

function MockInterviewPage() {
  const { notify } = useApp();
  const [catalog,setCatalog]=useState([]); const [history,setHistory]=useState([]); const [role,setRole]=useState(""); const [search,setSearch]=useState(""); const [aiConfigured,setAIConfigured]=useState(null);
  const [experience,setExperience]=useState("Fresher"); const [difficulty,setDifficulty]=useState("Medium"); const [mode,setMode]=useState("Text Based"); const [count,setCount]=useState("5"); const [customCount,setCustomCount]=useState(5);
  const [session,setSession]=useState(null); const [round,setRound]=useState(0); const [questions,setQuestions]=useState([]); const [questionProvider,setQuestionProvider]=useState(""); const [index,setIndex]=useState(0); const [answer,setAnswer]=useState(""); const [evaluation,setEvaluation]=useState(null); const [report,setReport]=useState(null);
  const [loading,setLoading]=useState(false); const [error,setError]=useState(""); const [stream,setStream]=useState(null); const [recording,setRecording]=useState(false); const [cameraConsent,setCameraConsent]=useState(false); const videoRef=useRef(null); const recorder=useRef(null); const chunks=useRef([]); const speech=useRef(null);
  const rounds=["Aptitude & Initial Screening","Technical Interview","Practical Assessment","HR & Behavioral Interview"];
  useEffect(()=>{api("/mock-interviews/roles").then(x=>{setCatalog(x.roles);setAIConfigured(Boolean(x.ai_configured));}).catch(e=>setError(e.message));api("/mock-interviews/history").then(x=>setHistory(x.sessions)).catch(()=>{});},[]);
  useEffect(()=>{if(videoRef.current&&stream)videoRef.current.srcObject=stream;},[stream]);
  useEffect(()=>()=>{stream?.getTracks().forEach(t=>t.stop());},[stream]);
  const releaseMedia=()=>{stream?.getTracks().forEach(t=>t.stop());setStream(null);setRecording(false);};
  const filtered=catalog.filter(x=>(!search||(`${x.title} ${x.category} ${x.skills.join(" ")}`).toLowerCase().includes(search.toLowerCase())));
  const start=async()=>{setLoading(true);setError("");try{const s=await api("/mock-interviews/start",jsonRequest("POST",{role,experience,difficulty,mode,questions_per_round:count==="custom"?customCount:Number(count)}));setSession(s);setRound(1);setIndex(0);setEvaluation(null);setReport(null);await loadRound(s.id,1);}catch(e){setError(e.message);}finally{setLoading(false);}};
  const loadRound=async(id,n)=>{setLoading(true);setError("");setQuestionProvider("");try{const data=await api(`/mock-interviews/${id}/round/${n}`,{method:"POST"});setQuestions(data.questions);setQuestionProvider(data.provider||"AI");setIndex(0);setEvaluation(null);setAnswer("");}catch(e){setError(e.message);}finally{setLoading(false);}};
  const nextRound=async()=>{if(round<4){const next=round+1;setRound(next);await loadRound(session.id,next);}};
  const submit=async e=>{e.preventDefault();if(!answer.trim())return;setLoading(true);setError("");try{const res=await api(`/mock-interviews/${session.id}/answer`,jsonRequest("POST",{round_number:round,question_index:index,answer}));setEvaluation(res.evaluation);if(res.report){setReport(res.report);releaseMedia();}notify("Answer evaluated and saved to your private interview history.");}catch(x){setError(x.message);}finally{setLoading(false);}};
  const advance=()=>{if(index+1<questions.length){setIndex(index+1);setAnswer("");setEvaluation(null);}else if(round<4)nextRound();};
  const enableMedia=async()=>{if(mode==="Camera + Microphone"&&!cameraConsent){setError("Confirm recording consent before enabling your camera and microphone.");return;}try{const value=await navigator.mediaDevices.getUserMedia({video:mode==="Camera + Microphone",audio:true});setStream(value);setError("");}catch(e){setError(e.name==="NotAllowedError"?"Camera or microphone permission was denied. Switch to Voice Only or Text Based mode.":"Camera or microphone is unavailable. You can continue with typed answers.");}};
  const record=()=>{if(!stream)return;if(recording){recorder.current?.stop();speech.current?.stop();setRecording(false);return;}chunks.current=[];const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(Recognition){const recognition=new Recognition();recognition.continuous=true;recognition.interimResults=true;recognition.lang=navigator.language||"en-US";recognition.onresult=e=>{const transcript=Array.from(e.results).map(item=>item[0].transcript).join(" ");setAnswer(transcript);};recognition.onerror=()=>setError("Speech recognition failed. You can type or edit your answer instead.");speech.current=recognition;recognition.start();}else setError("Speech recognition is unavailable in this browser. You can type your answer instead.");if("MediaRecorder" in window){const r=new MediaRecorder(stream);recorder.current=r;r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data);};r.onstop=()=>{chunks.current=[];};r.start();}setRecording(true);};
  const startFresh=()=>{releaseMedia();setSession(null);setReport(null);setQuestions([]);setQuestionProvider("");setError("");api("/mock-interviews/history").then(x=>setHistory(x.sessions)).catch(()=>{});};
  return <>
    <PageTitle title="Mock interview" subtitle="Practise with role-based questions, review answer feedback, and track your private session history." action={session&&!report?<Button variant="secondary" onClick={startFresh}>Save & leave</Button>:null}/>
    {!session&&<div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Card><div className="mb-4 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-600"><MessageSquareText size={20}/></span><div><h3 className="font-bold">Choose your target role</h3><p className="text-xs text-slate-500">{catalog.length} roles across six career categories</p></div></div><input className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Search roles, skills, or categories" value={search} onChange={e=>setSearch(e.target.value)}/><div className="max-h-72 space-y-2 overflow-auto">{filtered.map(item=><button key={item.title} type="button" aria-pressed={role===item.title} onClick={()=>setRole(item.title)} className={`w-full rounded-xl border p-3 text-left ${role===item.title?"border-violet-500 bg-violet-50":"border-slate-100 hover:border-violet-200"}`}><span className="flex items-center justify-between text-sm font-bold">{item.title}<span className="text-[10px] font-medium text-slate-400">{item.category}</span></span><span className="mt-1 block text-xs text-slate-500">{item.description}</span><span className="mt-2 flex flex-wrap gap-1">{item.skills.slice(0,5).map(skill=><span key={skill} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{skill}</span>)}</span></button>)}</div></Card>
      <Card><h3 className="font-bold">Interview configuration</h3><p className="mb-5 mt-1 text-xs text-slate-500">Questions are generated one round at a time using this context.</p>{aiConfigured===false&&<div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>AI provider setup needed.</strong> Configure <code>LLM_API_KEY</code>, <code>LLM_API_URL</code>, and <code>LLM_MODEL</code> in the project’s local <code>.env</code> file, then restart the server. Keep the key out of the browser and source control.</div>}<div className="space-y-4"><SelectInput label="Experience level" value={experience} onChange={e=>setExperience(e.target.value)} options={["Fresher","Beginner","Intermediate","Experienced"].map(value=>({value,label:value}))}/><SelectInput label="Difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value)} options={["Easy","Medium","Hard","Adaptive"].map(value=>({value,label:value}))}/><SelectInput label="Interview mode" value={mode} onChange={e=>setMode(e.target.value)} options={["Camera + Microphone","Voice Only","Text Based"].map(value=>({value,label:value}))}/><label className="block text-xs font-semibold">Questions per round<select className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" value={count} onChange={e=>setCount(e.target.value)}>{[5,10].map(v=><option key={v} value={String(v)}>{v}</option>)}<option value="custom">Custom</option></select></label>{count==="custom"&&<label className="block text-xs font-semibold">Custom count (1–20)<input aria-label="Custom questions per round" type="number" min="1" max="20" value={customCount} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" onChange={e=>setCustomCount(Math.max(1,Math.min(20,Number(e.target.value)||1)))}/></label>}<div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><strong>Selected:</strong> {role||"Choose a role"} · {experience} · {difficulty} · {count==="custom"?customCount:count} questions each across four rounds</div>{error&&<><ErrorState message={error}/>{error.toLowerCase().includes("sign in again")&&<button type="button" className="text-xs font-semibold text-violet-700 underline" onClick={async()=>{try{await signOut(auth);}finally{window.location.assign("/");}}}>Sign in again</button>}</>}<Button onClick={start} disabled={loading||!catalog.some(x=>x.title===role)}>{loading&&<LoaderCircle size={15} className="animate-spin"/>}Start interview</Button></div></Card></div>}
    {session&&!report&&<><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{rounds.map((name,i)=><div key={name} className={`rounded-2xl border p-4 ${round===i+1?"border-violet-400 bg-violet-50":"border-slate-200 bg-white"}`}><span className="text-[10px] font-bold uppercase text-violet-600">Round {i+1}</span><h3 className="mt-1 text-sm font-bold">{name}</h3><p className="mt-2 text-[11px] text-slate-500">{i+1<round?"Completed":i+1===round?`Question ${Math.min(index+1,questions.length)} of ${questions.length}`:"Not started"}</p></div>)}</div><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Card>{questionProvider==="Sample questions (AI offline)"&&<div role="status" className="interview-offline-notice mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Sample questions (AI offline).</strong>{" "}<span>These are examples, not AI-generated. Check your API key and quota, then retry for role-specific questions.</span></div>}{loading&&!questions.length?<Loading label="Generating this round's questions with AI..."/>:error&&!questions.length?<ErrorState message={error} onRetry={()=>loadRound(session.id,round)}/>:questions[index]&&<><div className="mb-4 flex items-center justify-between"><span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700">{rounds[round-1]} · {index+1}/{questions.length}</span><span className="text-xs text-slate-400">{questions[index].difficulty} · {questions[index].time_limit_seconds/60} min</span></div><div className="rounded-2xl bg-slate-50 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">{questions[index].category}</p><p className="mt-2 text-base font-semibold leading-7 text-slate-800">{questions[index].text}</p></div><form onSubmit={submit} className="mt-4 space-y-3">{questions[index].question_type==="code"&&<SelectInput label="Language" options={["Python","JavaScript","Java","C++","SQL"].map(v=>({value:v,label:v}))}/>}<TextArea label={questions[index].question_type==="code"?"Your solution":"Your answer"} rows={questions[index].question_type==="code"?9:6} maxLength={12000} required value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Explain your thinking and include relevant details..."/>{error&&<ErrorState message={error}/>} {!evaluation?<Button disabled={loading||!answer.trim()}>{loading&&<LoaderCircle size={15} className="animate-spin"/>}Submit answer</Button>:<Button type="button" onClick={advance}>{index+1<questions.length?"Next question":round<4?"Continue to next round":"View final report"}<ArrowRight size={15}/></Button>}</form>{evaluation&&<div className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-900"><strong className="text-sm">AI feedback · {evaluation.score}/100</strong><p className="mt-2 text-xs">{evaluation.feedback}</p><p className="mt-3 text-xs"><b>Covered:</b> {evaluation.correct_points.join(" · ")||"Review the feedback above."}</p><p className="mt-2 text-xs"><b>Explore further:</b> {evaluation.missing_concepts.join(" · ")||"Keep building on this answer."}</p><p className="mt-2 text-xs"><b>Improve:</b> {evaluation.improvement}</p><details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Suggested answer approach</summary><p className="mt-2">{evaluation.suggested_answer}</p></details></div>}</>}</Card>
      <div className="space-y-5"><Card><div className="flex items-center justify-between"><h3 className="font-bold">Practice setup</h3>{stream&&<button type="button" className="text-xs text-rose-600" onClick={releaseMedia}>Stop devices</button>}</div>{mode!=="Text Based"&&<div className="mt-3">{mode==="Camera + Microphone"&&<label className="mb-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={cameraConsent} onChange={e=>setCameraConsent(e.target.checked)}/>I consent to using my camera and microphone for this practice session. Video is not saved.</label>}<div className="overflow-hidden rounded-xl bg-slate-900">{mode==="Camera + Microphone"?<video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover"/>:<div className="grid aspect-video place-items-center text-white"><Mic size={28}/><span className="text-xs">Voice-only mode</span></div>}</div><div className="mt-3 flex gap-2"><Button variant="secondary" onClick={enableMedia}><Camera size={15}/>{stream?"Reconnect devices":"Enable devices"}</Button>{stream&&<Button variant="secondary" onClick={record}><Mic size={15}/>{recording?"Stop recording":"Record answer"}</Button>}</div><p className="mt-2 text-[10px] text-slate-500">Speech recognition runs in your browser when supported. Audio and video recordings are not saved.</p></div>}<p className="mt-4 text-xs text-slate-500">{session.role} · {session.experience} · {session.difficulty} · {session.mode}</p></Card><Card><h3 className="font-bold">Question progress</h3><div className="mt-4 space-y-3">{rounds.map((x,i)=><div key={x}><div className="mb-1 flex justify-between text-[11px]"><span>{x}</span><span>{i+1<round?"Complete":i+1===round?`${index}/${questions.length}`:"—"}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-500" style={{width:`${i+1<round?100:i+1===round?Math.round(index/questions.length*100):0}%`}}/></div></div>)}</div></Card></div></div></>}
    {report&&<div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><Card><h3 className="text-lg font-bold">Interview performance report</h3><p className="mt-1 text-sm text-slate-500">{report.role} · four rounds completed</p><div className="mt-5 rounded-2xl bg-violet-50 p-5"><strong className="text-4xl font-extrabold text-violet-700">{report.overall_score}<small className="text-base">/100</small></strong><p className="mt-2 text-xs text-slate-600">{report.total_questions} answers · {report.correct_answers} scored 70 or higher</p><p className="mt-2 text-[10px] text-slate-500">{report.weighting}</p></div><h4 className="mt-5 text-sm font-bold">Round scores</h4>{rounds.map((name,i)=><div key={name} className="mt-3"><div className="mb-1 flex justify-between text-xs"><span>{name}</span><b>{report.round_scores[String(i+1)]}/100</b></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-500" style={{width:`${report.round_scores[String(i+1)]}%`}}/></div></div>)}<Button className="mt-5" onClick={startFresh}>Retry interview</Button></Card><Card><h3 className="font-bold">Your feedback</h3><h4 className="mt-4 text-xs font-bold text-emerald-700">Strengths</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">{report.strengths.length?report.strengths.map(x=><li key={x}>{x}</li>):<li>Review your question feedback to identify strengths.</li>}</ul><h4 className="mt-4 text-xs font-bold text-amber-700">Topics to improve</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">{report.improvement_areas.length?report.improvement_areas.map(x=><li key={x}>{x}</li>):<li>Continue practicing clear, complete explanations.</li>}</ul><details className="mt-5"><summary className="cursor-pointer text-sm font-bold">Question-wise feedback</summary><div className="mt-3 max-h-96 space-y-3 overflow-auto">{report.answers.map((item,i)=><div key={item.question.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold">{i+1}. {item.question.text}</p><p className="mt-1 text-[11px] text-violet-700">Score {item.evaluation.score}/100 · {item.evaluation.feedback}</p></div>)}</div></details></Card></div>}
    {!session&&history.length>0&&<Card className="mt-5"><h3 className="font-bold">Interview history</h3><div className="mt-3 space-y-2">{history.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs"><span><b>{item.role}</b> · {item.difficulty} · {new Date(item.created_at).toLocaleDateString()}</span><span>{item.completed?`Score ${item.overall_score}/100`:"In progress"}</span></div>)}</div></Card>}
  </>;
}

function InterviewReport({ report }) {
  return <div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Award size={23}/></span><h3 className="mt-4 text-lg font-bold">Interview complete</h3><p className="mt-1 text-xs text-slate-500">{report.role} · {report.difficulty}</p><div className="mt-5 rounded-2xl bg-violet-50 p-5"><strong className="text-3xl font-extrabold text-violet-700">{report.overall_score}<small className="text-sm">/100</small></strong><p className="mt-2 text-sm text-slate-600">{report.summary}</p></div><h4 className="mt-5 text-sm font-bold">Improvement tips</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">{(report.tips || []).map(tip => <li key={tip}>{tip}</li>)}</ul></div>;
}

function RecommendationsPage() {
  const { data, loading, error, reload } = useResource(() => api("/recommendations"));
  return <>
    <PageTitle title="Job recommendations" subtitle="Explore roles, courses, projects, and credentials that fit your current skill profile."/>
    {loading && <Loading/>}{error && <ErrorState message={error} onRetry={reload}/>}
    {data && <div className="grid gap-5 lg:grid-cols-2">
      <Card><h3 className="mb-4 font-bold">Recommended roles</h3>{data.roles?.length ? data.roles.map(role => <div key={role.role} className="mb-3 rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between"><strong className="text-sm">{role.role}</strong><SkillChip tone="matched">{Math.min(99, Number(role.match_score) || 0)}% estimated fit</SkillChip></div><p className="mt-1 text-xs text-slate-500">{role.why_this_role_fits}</p></div>) : <EmptyState title="Analyse a resume first" description="Role recommendations will be personalised after your first analysis."/ >}</Card>
      <Card><h3 className="mb-4 font-bold">Learning & credentials</h3>{(data.learning_resources || []).map(resource => <div key={resource.title} className="mb-3 flex gap-3 rounded-xl bg-slate-50 p-3"><GraduationCap className="shrink-0 text-violet-600" size={18}/><div><strong className="text-xs">{resource.title}</strong><p className="mt-1 text-[11px] text-slate-500">{resource.skill} · {resource.type}</p></div></div>)}</Card>
      <Card className="lg:col-span-2"><h3 className="mb-4 font-bold">Suggested projects</h3><div className="grid gap-3 md:grid-cols-3">{(data.projects || []).map(project => <div key={project} className="rounded-xl border border-slate-100 p-4"><Sparkles size={16} className="mb-3 text-violet-500"/><p className="text-xs leading-5 text-slate-600">{project}</p></div>)}</div></Card>
    </div>}
  </>;
}

function PlacementDrivesPage() {
  const { notify } = useApp();
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("date");
  const { data, loading, error, reload } = useResource(() => api(`/drives?type=${encodeURIComponent(filter)}&sort=${sort}`), [filter, sort]);
  const [adminToken, setAdminToken] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [newDrive, setNewDrive] = useState({ company:"", role:"", eligibility:"", package_lpa:"", date:"", mode:"Virtual", type:"Off Campus", apply_url:"", required_skills:"" });
  const [adminError, setAdminError] = useState("");
  const apply = async drive => {
    try { await api(`/drives/${drive.id}/apply`, { method:"POST" }); notify(`Application interest saved for ${drive.company}.`); reload(); }
    catch (failure) { setAdminError(failure.message); }
  };
  const addDrive = async event => {
    event.preventDefault(); setAdminError("");
    try {
      await api("/drives", { ...jsonRequest("POST", { ...newDrive, required_skills:newDrive.required_skills.split(",").map(skill => skill.trim()).filter(Boolean) }), headers:{ "X-Admin-Token":adminToken } });
      notify("Placement drive added."); setNewDrive({ company:"", role:"", eligibility:"", package_lpa:"", date:"", mode:"Virtual", type:"Off Campus", apply_url:"", required_skills:"" }); reload();
    } catch (failure) { setAdminError(failure.message); }
  };
  const filters = ["All","On Campus","Off Campus","Virtual"];
  return <>
    <PageTitle title="Placement drives" subtitle="Review eligibility, compare opportunities, and save drives you want to explore." action={<Button variant="secondary" onClick={() => setShowAdmin(value => !value)}><Plus size={15}/>Admin tools</Button>}/>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{filters.map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-4 py-2 text-xs font-semibold ${filter === item ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{item}</button>)}</div><SelectInput label="Sort by" value={sort} onChange={event => setSort(event.target.value)} options={[{value:"date",label:"Date"},{value:"match",label:"Best match"}]}/></div>
    {showAdmin && <Card className="mb-5"><h3 className="mb-4 font-bold">Add a drive (administrator)</h3><form onSubmit={addDrive} className="grid gap-3 md:grid-cols-3"><TextInput label="Admin token" type="password" value={adminToken} onChange={event => setAdminToken(event.target.value)}/><TextInput label="Company" required value={newDrive.company} onChange={event => setNewDrive({...newDrive,company:event.target.value})}/><TextInput label="Role" required value={newDrive.role} onChange={event => setNewDrive({...newDrive,role:event.target.value})}/><TextInput label="Eligibility" value={newDrive.eligibility} onChange={event => setNewDrive({...newDrive,eligibility:event.target.value})}/><TextInput label="Package (₹ LPA)" value={newDrive.package_lpa} onChange={event => setNewDrive({...newDrive,package_lpa:event.target.value})}/><TextInput label="Date" type="date" required value={newDrive.date} onChange={event => setNewDrive({...newDrive,date:event.target.value})}/><SelectInput label="Mode" value={newDrive.mode} onChange={event => setNewDrive({...newDrive,mode:event.target.value})} options={["On Campus","Off Campus","Virtual"].map(value=>({value,label:value}))}/><TextInput label="Apply URL" type="url" value={newDrive.apply_url} onChange={event => setNewDrive({...newDrive,apply_url:event.target.value})}/><TextInput label="Required skills (comma separated)" value={newDrive.required_skills} onChange={event => setNewDrive({...newDrive,required_skills:event.target.value})}/><div className="md:col-span-3">{adminError && <p className="mb-2 text-xs text-rose-700">{adminError}</p>}<Button type="submit">Add placement drive</Button></div></form></Card>}
    {loading && <Loading label="Loading placement drives..."/>}{error && <ErrorState message={error} onRetry={reload}/>}
    {data && <>{data.sample_note && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{data.sample_note}</p>}{data.drives?.length ? <div className="grid gap-4 xl:grid-cols-2">{data.drives.map(drive => <Card key={drive.id} className="relative overflow-hidden"><div className="absolute right-5 top-5"><SkillChip tone={drive.match_percent >= 70 ? "matched" : "weak"}>{Math.min(99, Number(drive.match_percent) || 0)}% estimated match</SkillChip></div><div className="flex gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700"><BriefcaseBusiness size={20}/></span><div className="pr-20"><h3 className="font-bold">{drive.company}</h3><p className="mt-1 text-xs text-slate-500">{drive.role}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500"><span><strong className="text-slate-700">Eligibility</strong><br/>{drive.eligibility || "See application details"}</span><span><strong className="text-slate-700">Package</strong><br/>{drive.package_lpa || "Not specified"}</span><span><strong className="text-slate-700">Date</strong><br/>{drive.date}</span><span><strong className="text-slate-700">Mode</strong><br/>{drive.mode}</span></div>{drive.is_sample && <p className="mt-3 text-[10px] text-amber-700">Sample listing — verify before applying.</p>}<div className="mt-4 flex gap-2"><Button onClick={() => apply(drive)}>{drive.applied ? "Interest saved" : "Save interest"}<ArrowRight size={14}/></Button>{drive.apply_url && <a className="button-secondary inline-flex items-center gap-2 rounded-xl border px-4 text-xs font-semibold" href={drive.apply_url} target="_blank" rel="noreferrer">Apply externally</a>}</div></Card>)}</div> : <EmptyState icon={CalendarDays} title={filter === "All" ? "No drives yet" : "No drives in this filter"} description={filter === "All" ? "Add your first opportunity to get started." : "Try another mode or check back later."} action={filter === "All" ? <Button variant="secondary" onClick={() => setShowAdmin(true)}>Add your first opportunity</Button> : null}/>}</>}
  </>;
}

function DocumentsPage() {
  const { data, loading, error, reload } = useResource(() => api("/documents"));
  const { notify } = useApp();
  const [compare, setCompare] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const upload = async file => {
    if (!file || !/\.(pdf|docx)$/i.test(file.name)) return setUploadError("Choose a PDF or DOCX file.");
    const form = new FormData(); form.append("document", file);
    setUploading(true); setUploadError("");
    try { await api("/documents", { method:"POST", body:form }); notify("Resume version saved."); reload(); }
    catch (failure) { setUploadError(failure.message); }
    finally { setUploading(false); }
  };
  const deleteDocument = async id => {
    if (!confirm("Delete this uploaded resume version?")) return;
    try { await api(`/documents/${id}`, { method:"DELETE" }); reload(); notify("Resume version deleted."); }
    catch (failure) { setUploadError(failure.message); }
  };
  const download = async item => {
    try {
      const response = await api(`/documents/${item.id}/download`, { raw:true });
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href=url; link.download=item.filename; link.click(); URL.revokeObjectURL(url);
    } catch (failure) { setUploadError(failure.message); }
  };
  const comparison = useResource(async () => compare.length === 2 ? api(`/documents/compare?first=${compare[0]}&second=${compare[1]}`) : null, [compare.join(",")]);
  return <>
    <PageTitle title="Documents" subtitle="Keep your resume versions together and compare analysis scores."/>
    <Card className="mb-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold">Resume versions</h3><p className="mt-1 text-xs text-slate-500">Private to your signed-in account. Stored in the app database.</p></div><label className="button-primary inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white">{uploading ? <LoaderCircle className="animate-spin" size={15}/> : <Upload size={15}/>}Upload version<input className="hidden" type="file" accept=".pdf,.docx" onChange={event => upload(event.target.files?.[0])}/></label></div>{uploadError && <div className="mt-3"><ErrorState message={uploadError}/></div>}</Card>
    {loading && <Loading/>}{error && <ErrorState message={error} onRetry={reload}/>}
    {data && <Card>{data.documents?.length ? <div className="divide-y divide-slate-100">{data.documents.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><FileText size={18}/></span><div className="min-w-0"><strong className="block truncate text-sm">{item.filename}</strong><span className="text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString()} · Score {item.resume_score ?? "not analyzed"}</span></div></div><div className="flex items-center gap-2"><label className="flex items-center gap-1 text-[10px] text-slate-500"><input type="checkbox" checked={compare.includes(item.id)} onChange={event => setCompare(previous => event.target.checked ? [...previous,item.id].slice(-2) : previous.filter(id=>id!==item.id))}/>Compare</label><button onClick={() => download(item)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Download ${item.filename}`}><ArrowDownToLine size={17}/></button><button onClick={() => deleteDocument(item.id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label={`Delete ${item.filename}`}><Trash2 size={16}/></button></div></div>)}</div> : <EmptyState icon={FileText} title="No resume versions yet" description="Upload a PDF or DOCX to save it to your documents."/ >}</Card>}
    {compare.length === 2 && comparison.data && <Card className="mt-5"><h3 className="mb-4 font-bold">Version comparison</h3><div className="grid gap-4 sm:grid-cols-2">{comparison.data.versions.map(version => <div key={version.id} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{version.filename}</p><strong className="mt-1 block text-2xl">{version.resume_score ?? "—"}<span className="text-sm text-slate-400">/100</span></strong></div>)}</div>{comparison.data.score_difference != null && <p className="mt-3 text-xs text-slate-600">Score difference: {comparison.data.score_difference > 0 ? "+" : ""}{comparison.data.score_difference} points</p>}</Card>}
  </>;
}

function CertificatesPage() {
  const { data, loading, error, reload } = useResource(() => api("/certificates"));
  const { notify } = useApp();
  const downloadProof = async item => {
    try {
      const response = await api(`/progress/${item.id}/proof`, { raw: true });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = item.proof_filename || "certificate-proof";
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) { notify(`Unable to download certificate proof: ${failure.message}`); }
  };
  return <>
    <PageTitle title="Certificates" subtitle="Review credentials earned through your CareerInfinity learning and assessment journey."/>
    {loading && <Loading/>}{error && <ErrorState message={error} onRetry={reload}/>}
    {data && <>{data.roadmap_certifications?.length > 0 && <Card className="mb-5"><h3 className="mb-1 font-bold">Completed roadmap certifications</h3><p className="mb-4 text-[10px] text-slate-400">Completion dates and proof are user-reported; verification is not performed with credential issuers.</p><div className="grid gap-3 md:grid-cols-2">{data.roadmap_certifications.map(item => <div key={item.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{item.title}</strong>{item.verified ? <SkillChip tone="matched">Proof added</SkillChip> : <SkillChip tone="neutral">Completed</SkillChip>}</div><p className="mt-1 text-xs text-slate-500">{item.provider} · completed {item.issued_at ? new Date(item.issued_at).toLocaleDateString() : "date unavailable"}</p><a className="mt-3 inline-block text-xs font-semibold text-violet-700" href={item.resource_url} target="_blank" rel="noreferrer">Open certification</a>{item.verify_url && <a className="ml-3 text-xs font-semibold text-violet-700" href={item.verify_url} target="_blank" rel="noreferrer">Proof link</a>}{item.proof_download_url && <button className="ml-3 text-xs font-semibold text-violet-700" onClick={() => downloadProof(item)}>Download proof</button>}</div>)}</div></Card>}{data.certificates?.length ? <div className="grid gap-4 md:grid-cols-2">{data.certificates.map(certificate => <Card key={certificate.id}><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-600"><Award size={21}/></span><SkillChip tone="matched">Verified</SkillChip></div><h3 className="mt-4 font-bold">{certificate.title}</h3><p className="mt-1 text-xs text-slate-500">Issued {certificate.issued_at || "—"}</p><div className="mt-4 flex gap-3"><a className="text-xs font-semibold text-violet-700" href={certificate.verify_url} target="_blank" rel="noreferrer">Verify</a>{certificate.download_url && <a className="text-xs font-semibold text-violet-700" href={certificate.download_url}>Download</a>}<button onClick={() => navigator.clipboard.writeText(certificate.verify_url || window.location.href)} className="text-xs font-semibold text-violet-700">Share</button></div></Card>)}</div> : <EmptyState icon={Award} title="No certificates earned yet" description="Complete an assessment or course to earn certificates. Earned credentials show here when available."/ >}{data.catalog?.length > 0 && <Card className="mt-5"><h3 className="mb-4 font-bold">Recommended credentials</h3><div className="grid gap-3 md:grid-cols-2">{data.catalog.map(item => <div key={item.title} className="rounded-xl border border-slate-100 p-4"><strong className="text-sm">{item.title}</strong><p className="mt-1 text-xs text-slate-500">{item.provider} · {item.level}</p>{item.url && <a className="mt-2 inline-block text-xs font-semibold text-violet-700" href={item.url} target="_blank" rel="noreferrer">Explore credential</a>}</div>)}</div></Card>}</>}
  </>;
}

function SettingsPage() {
  const { data, loading, error, reload } = useResource(() => api("/settings"));
  const { notify, theme, setTheme } = useApp();
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (!data) return;
    setForm(data);
    if (data.theme) setTheme(data.theme);
  }, [data, setTheme]);
  const save = async event => {
    event.preventDefault();
    const payload = {
      name: form.name || "",
      target_role: form.target_role || "",
      education: form.education || "",
      preferred_location: form.preferred_location || "",
      notifications_enabled: form.notifications_enabled !== false,
      theme,
    };
    try { await api("/settings", jsonRequest("PATCH", payload)); notify("Settings saved."); reload(); }
    catch (failure) { alert(failure.message); }
  };
  return <>
    <PageTitle title="Settings" subtitle="Manage your profile, career preferences, notifications, and appearance."/>
    {loading && <Loading/>}{error && <ErrorState message={error} onRetry={reload}/>}
    {form && <Card className="max-w-3xl"><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <TextInput label="Name" value={form.name || ""} onChange={event => setForm({...form,name:event.target.value})}/>
      <SelectInput label="Target role" value={form.target_role || ""} onChange={event => setForm({...form,target_role:event.target.value})} options={["",...(form.available_roles || [])].map(value=>({value,label:value || "Choose a role"}))}/>
      <TextInput label="Preferred location" value={form.preferred_location || ""} onChange={event => setForm({...form,preferred_location:event.target.value})}/>
      <TextInput label="Education" value={form.education || ""} onChange={event => setForm({...form,education:event.target.value})}/>
      <div className="sm:col-span-2"><h3 className="mb-2 text-sm font-bold">Notifications</h3><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={form.notifications_enabled !== false} onChange={event => setForm({...form,notifications_enabled:event.target.checked})}/>Email me important placement updates</label></div>
      <SelectInput label="Theme" value={theme} onChange={event => { setTheme(event.target.value); setForm({...form,theme:event.target.value}); }} options={[{value:"light",label:"Light"},{value:"dark",label:"Dark"}]}/>
      <div className="sm:col-span-2"><Button type="submit">Save settings</Button></div>
    </form></Card>}
  </>;
}

function HelpPage() {
  const { notify } = useApp();
  const [category, setCategory] = useState("Feedback");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async event => {
    event.preventDefault(); setError("");
    try { await api("/feedback", jsonRequest("POST", { category, message })); setMessage(""); notify("Thank you — your feedback was saved."); }
    catch (failure) { setError(failure.message); }
  };
  const faqs = [
    ["How is my resume score calculated?","The analyzer evaluates detected skills, project signals, impact metrics, structure, and keywords. It is an estimate, not a hiring decision."],
    ["Are placement listings guaranteed to be current?","Sample listings are clearly marked. Confirm dates, eligibility, and package details with the employer before applying."],
    ["Is my resume sent to an AI service?","Only when an optional LLM provider is configured. Without that setting, resume analysis runs locally in the app."],
    ["How do I delete a saved resume?","Open Documents and use the delete button next to the version you want removed."],
  ];
  return <>
    <PageTitle title="Help & support" subtitle="Find answers to common questions or send feedback to the CareerInfinity team."/>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Card><h3 className="mb-4 font-bold">Frequently asked questions</h3><div className="space-y-3">{faqs.map(([question,answer]) => <details key={question} className="rounded-xl border border-slate-100 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">{question}</summary><p className="mt-3 text-xs leading-5 text-slate-500">{answer}</p></details>)}</div></Card>
      <Card><h3 className="font-bold">Contact & feedback</h3><p className="mb-4 mt-1 text-xs text-slate-500">Tell us what would make your career workspace more useful.</p><form onSubmit={submit} className="space-y-4"><SelectInput label="Topic" value={category} onChange={event => setCategory(event.target.value)} options={["Feedback","Bug report","Account support","Feature request"].map(value=>({value,label:value}))}/><TextArea label="Message" rows={6} required minLength={5} maxLength={3000} value={message} onChange={event => setMessage(event.target.value)}/>{error && <ErrorState message={error}/>}<Button type="submit">Send message</Button></form></Card>
    </div>
  </>;
}

export default App;
