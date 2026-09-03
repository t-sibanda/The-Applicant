import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";

// Route-level code splitting: each page loads on demand so the initial bundle
// stays small and the app shell appears fast.
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
// Profiles renders inside ProfileHub as a tab; no standalone route needed.
const Jobs = lazy(() => import("@/pages/Jobs"));
const Resume = lazy(() => import("@/pages/Resume"));
const Optimizer = lazy(() => import("@/pages/Optimizer"));
const Applications = lazy(() => import("@/pages/Applications"));
const Billing = lazy(() => import("@/pages/Billing"));
const Admin = lazy(() => import("@/pages/Admin"));
const Support = lazy(() => import("@/pages/Support"));
const ProfileHub = lazy(() => import("@/pages/ProfileHub"));
const Growth = lazy(() => import("@/pages/Growth"));
const Account = lazy(() => import("@/pages/Account"));
const Voice = lazy(() => import("@/pages/Voice"));
const Demo = lazy(() => import("@/pages/Demo"));
const Story = lazy(() => import("@/pages/Story"));
const Landing = lazy(() => import("@/pages/Landing"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
      Loading…
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Loading…
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

// Root: logged-in users see their dashboard; visitors see the marketing landing.
function Root() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading)
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>;
  return isAuthenticated ? <AppLayout><Dashboard /></AppLayout> : <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/story" element={<Story />} />
        <Route path="/home" element={<Landing />} />
        <Route path="/" element={<Root />} />
        <Route path="/profiles" element={<Protected><ProfileHub /></Protected>} />
        <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
        <Route path="/resume" element={<Protected><Resume /></Protected>} />
        <Route path="/optimizer" element={<Protected><Optimizer /></Protected>} />
        <Route path="/voice" element={<Protected><Voice /></Protected>} />
        {/* Merged pages; old paths redirect so existing links keep working. */}
        <Route path="/portfolio" element={<Navigate to="/profiles" replace />} />
        <Route path="/growth" element={<Protected><Growth /></Protected>} />
        <Route path="/career" element={<Navigate to="/growth" replace />} />
        <Route path="/learning" element={<Navigate to="/growth" replace />} />
        <Route path="/applications" element={<Protected><Applications /></Protected>} />
        <Route path="/support" element={<Protected><Support /></Protected>} />
        <Route path="/account" element={<Protected><Account /></Protected>} />
        <Route path="/billing" element={<Protected><Billing /></Protected>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
