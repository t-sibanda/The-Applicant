import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Send, Download, Save, Loader2, Bot, FileText, Plus, BarChart3, Gauge } from "lucide-react";

/**
 * Stateful resume assistant: a persistent multi-turn thread that edits a
 * downloadable working document. Separate from the one-shot AI Coach.
 */
export function Assistant() {
  const utils = trpc.useUtils();
  const conversations = trpc.assistant.list.useQuery();
  const [convId, setConvId] = useState<number | null>(null);

  const create = trpc.assistant.create.useMutation();
  const send = trpc.assistant.send.useMutation();
  const saveDoc = trpc.assistant.saveDocToResume.useMutation();
  const setDoc = trpc.assistant.setWorkingDoc.useMutation();

  const thread = trpc.assistant.getMessages.useQuery(
    { conversationId: convId ?? 0 },
    { enabled: convId != null },
  );

  const [input, setInput] = useState("");
  const [workingDoc, setWorkingDoc] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Live ATS scoring against a pasted job description.
  const [showAts, setShowAts] = useState(false);
  const [atsJd, setAtsJd] = useState("");
  const [ats, setAts] = useState<any | null>(null);
  const atsMut = trpc.ai.atsScore.useMutation();

  const scoreAts = async () => {
    if (!atsJd.trim()) return toast.error("Paste a job description to score against");
    if (!workingDoc.trim()) return toast.error("Your working document is empty");
    try {
      const res = await atsMut.mutateAsync({ resumeText: workingDoc, jobDescription: atsJd });
      if (res.success && res.content) setAts(JSON.parse(res.content));
      else toast.error(res.error ?? "Scoring failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  // Auto-select or create a conversation.
  useEffect(() => {
    if (conversations.data && convId == null) {
      if (conversations.data.length > 0) setConvId(conversations.data[0].id);
    }
  }, [conversations.data, convId]);

  useEffect(() => {
    if (thread.data?.conversation) setWorkingDoc(thread.data.conversation.workingDoc ?? "");
  }, [thread.data?.conversation?.id, thread.data?.conversation?.workingDoc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.data?.messages?.length, send.isPending]);

  const startNew = async () => {
    const conv = await create.mutateAsync({ title: "Resume Assistant" });
    await utils.assistant.list.invalidate();
    setConvId(conv.id);
  };

  const submit = async () => {
    if (!input.trim()) return;
    let id = convId;
    if (id == null) {
      const conv = await create.mutateAsync({ title: "Resume Assistant" });
      await utils.assistant.list.invalidate();
      id = conv.id;
      setConvId(id);
    }
    const text = input;
    setInput("");
    try {
      const res = await send.mutateAsync({ conversationId: id, content: text });
      if (!res.success) toast.error(res.error ?? "Failed");
      else if (res.documentChanged) {
        setWorkingDoc(res.workingDoc ?? "");
        toast.success("Document updated");
      }
      await utils.assistant.getMessages.invalidate({ conversationId: id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const download = () => {
    if (!workingDoc) return toast.error("No document yet");
    const blob = new Blob([workingDoc], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "My_Resume.txt";
    a.click();
    toast.success("Downloaded");
  };

  const saveToResume = async () => {
    if (convId == null) return;
    await saveDoc.mutateAsync({ conversationId: convId });
    toast.success("Saved to your base resume");
  };

  const msgs = thread.data?.messages ?? [];

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Chat panel */}
      <div className="card flex flex-col h-[560px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-brand" />
            <span className="font-bold text-sm text-slate-800">Resume Assistant</span>
          </div>
          <button onClick={startNew} className="btn-ghost h-8 px-3 text-xs"><Plus className="w-3.5 h-3.5" /> New</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {msgs.length === 0 && (
            <div className="text-center py-10">
              <Bot className="w-10 h-10 mx-auto text-slate-200 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Let's improve your resume together</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Ask me to rewrite a section, quantify achievements, tailor for a role, or fix wording.
                I'll edit the live document on the right — always downloadable.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {["Make my summary stronger", "Quantify my achievements", "Improve my most recent role"].map((q) => (
                  <button key={q} onClick={() => setInput(q)} className="text-[11px] px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100">{q}</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-brand text-white" : "bg-slate-50 text-slate-700"}`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          {send.isPending && (
            <div className="flex justify-start"><div className="rounded-2xl px-3.5 py-2.5 bg-slate-50"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div></div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t border-[var(--border)] flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask me to improve your resume…"
            className="input flex-1"
          />
          <button onClick={submit} disabled={send.isPending || !input.trim()} className="btn-primary px-4">
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Working document panel */}
      <div className="card flex flex-col h-[560px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand" />
            <span className="font-bold text-sm text-slate-800">Working document</span>
          </div>
          <div className="flex gap-2">
            <button onClick={download} className="btn-ghost h-8 px-3 text-xs"><Download className="w-3.5 h-3.5" /> Download</button>
            <button onClick={saveToResume} disabled={saveDoc.isPending} className="btn-ghost h-8 px-3 text-xs"><Save className="w-3.5 h-3.5" /> Save</button>
          </div>
        </div>
        <textarea
          value={workingDoc}
          onChange={(e) => setWorkingDoc(e.target.value)}
          onBlur={() => {
            if (convId != null) setDoc.mutate({ conversationId: convId, doc: workingDoc });
          }}
          className="flex-1 p-4 text-sm text-slate-700 resize-none outline-none font-mono whitespace-pre-wrap"
          placeholder="Your working resume appears here. It updates as the assistant makes changes, and you can edit it directly."
        />
      </div>

      {/* Live ATS scoring — score the working doc against a job, iterate in place */}
      <div className="card p-4 lg:col-span-2">
        <button onClick={() => setShowAts((v) => !v)} className="flex items-center gap-2 w-full text-left">
          <Gauge className="w-4 h-4 text-brand" />
          <span className="font-bold text-sm text-slate-800">Live ATS score</span>
          <span className="text-xs text-slate-400">— score this document against a job and iterate</span>
          <span className="ml-auto text-slate-300">{showAts ? "−" : "+"}</span>
        </button>
        {showAts && (
          <div className="mt-3 space-y-3">
            <textarea value={atsJd} onChange={(e) => setAtsJd(e.target.value)} className="textarea min-h-[90px]" placeholder="Paste the target job description…" />
            <button onClick={scoreAts} disabled={atsMut.isPending} className="btn-primary">
              {atsMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Scoring…</> : <><BarChart3 className="w-4 h-4" /> Score against this job</>}
            </button>
            {ats && (
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm text-slate-800">ATS match</span>
                  <span className="text-2xl font-extrabold text-brand">{ats.overallScore}%</span>
                </div>
                {ats.breakdown && (
                  <div className="space-y-1.5 mb-3">
                    {Object.entries(ats.breakdown as Record<string, number>).map(([k, v]) => (
                      <div key={k}>
                        <div className="flex justify-between text-[11px]"><span className="capitalize text-slate-500">{k.replace(/([A-Z])/g, " $1")}</span><span className="text-slate-400">{v}%</span></div>
                        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${v}%` }} /></div>
                      </div>
                    ))}
                  </div>
                )}
                {(ats.keywordMatch?.missing ?? []).length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-rose-700 mb-1">Add these keywords (if you have them)</div>
                    <div className="flex flex-wrap gap-1">{(ats.keywordMatch?.missing ?? []).slice(0, 15).map((k: string, i: number) => <span key={i} className="chip bg-white text-rose-700">{k}</span>)}</div>
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-3">Ask the assistant to weave in the missing keywords, then re-score.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
