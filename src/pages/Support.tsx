import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { LifeBuoy, Loader2, BookOpen, MessageSquare, CreditCard } from "lucide-react";

const FAQ = [
  { q: "How do I start finding jobs?", a: "Set up a profile with the industry and role you're after, mark it active, then run a search on the Jobs page." },
  { q: "Why can't I use the AI tools?", a: "The AI Optimizer sits on the paid plans. Upgrade to Basic or Pro from the Billing page to switch it on." },
  { q: "How does it write in my voice?", a: "Head to the Resume page and paste a writing sample under 'Voice profile'. We'll learn your tone and carry it through your resumes and letters." },
  { q: "Where do my documents go?", a: "Hit Save on any resume or cover letter and it lands under 'Saved documents' on the Resume page." },
];

export default function Support() {
  const create = trpc.admin.createSupportRequest.useMutation();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return toast.error("Fill in both fields");
    await create.mutateAsync({ subject, message });
    setSubject(""); setMessage("");
    toast.success("Sent. We'll get back to you soon.");
  };

  return (
    <div className="max-w-3xl">
      <h1 className="page-title">Help &amp; Support</h1>
      <p className="page-subtitle mb-5">Find answers fast or reach out to us directly.</p>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {[
          { icon: BookOpen, label: "Getting started", desc: "Profile → resume → search" },
          { icon: MessageSquare, label: "Using the AI", desc: "Tailor, cover, ATS, coach" },
          { icon: CreditCard, label: "Billing", desc: "Plans & upgrades" },
        ].map((c) => (
          <div key={c.label} className="card p-4">
            <c.icon className="w-5 h-5 text-brand mb-2" />
            <div className="font-semibold text-sm text-slate-800">{c.label}</div>
            <div className="text-xs text-slate-500">{c.desc}</div>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-5">
        <h3 className="font-bold text-sm text-slate-800 mb-3">Frequently asked</h3>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700 list-none flex items-center justify-between">
                {f.q}
                <span className="text-slate-300 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
              </summary>
              <p className="text-sm text-slate-500 mt-1.5">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <LifeBuoy className="w-4 h-4 text-brand" />
          <h3 className="font-bold text-sm text-slate-800">Contact support</h3>
        </div>
        <div className="space-y-3">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="Subject" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="textarea min-h-[120px]" placeholder="How can we help?" />
          <button onClick={submit} disabled={create.isPending} className="btn-primary">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LifeBuoy className="w-4 h-4" />} Send message
          </button>
        </div>
      </div>
    </div>
  );
}
