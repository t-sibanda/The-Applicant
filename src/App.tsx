import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Profiles from "@/pages/Profiles";
import Jobs from "@/pages/Jobs";
import Resume from "@/pages/Resume";
import Optimizer from "@/pages/Optimizer";
import Applications from "@/pages/Applications";
import Billing from "@/pages/Billing";
import Admin from "@/pages/Admin";
import Support from "@/pages/Support";
import Portfolio from "@/pages/Portfolio";
import Career from "@/pages/Career";
import Learning from "@/pages/Learning";
import Account from "@/pages/Account";
import Voice from "@/pages/Voice";
import Demo from "@/pages/Demo";
import Story from "@/pages/Story";
import Landing from "@/pages/Landing";

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/story" element={<Story />} />
        <Route path="/home" element={<Landing />} />
        <Route path="/" element={<Root />} />
        <Route path="/profiles" element={<Protected><Profiles /></Protected>} />
        <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
        <Route path="/resume" element={<Protected><Resume /></Protected>} />
        <Route path="/optimizer" element={<Protected><Optimizer /></Protected>} />
        <Route path="/voice" element={<Protected><Voice /></Protected>} />
        <Route path="/portfolio" element={<Protected><Portfolio /></Protected>} />
        <Route path="/career" element={<Protected><Career /></Protected>} />
        <Route path="/learning" element={<Protected><Learning /></Protected>} />
        <Route path="/applications" element={<Protected><Applications /></Protected>} />
        <Route path="/support" element={<Protected><Support /></Protected>} />
        <Route path="/account" element={<Protected><Account /></Protected>} />
        <Route path="/billing" element={<Protected><Billing /></Protected>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
