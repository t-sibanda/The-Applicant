import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSpeech } from "@/hooks/useSpeech";
import {
  UserRound, Sparkles, Loader2, Mic, MicOff, Wand2, MessageSquareText, Save,
} from "lucide-react";

// Guided prompts that draw out character. The user can answer any, all, or
// none of these, or just write freely.
const PROMPTS = [
  "In your own words, who are you?",
  "What do you do in your spare time?",
  "What do you genuinely love about yourself?",
  "Tell me about a time you're proud of.",
  "What was your childhood like?",
  "What kind of person do people count on you to be?",
  "What matters most to you at work?",
];

export default function PersonaStudio() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const personaQuery = trpc.voice.getPersona.useQuery();
  const build = trpc.voice.buildPersona.useMutation();
  const nextQ = trpc.voice.personaNextQuestion.useMutation();

  const [text, setText] = useState("");
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const persona = personaQuery.data?.persona;

  const speech = useSpeech((chunk) => setText((t) => (t ? `${t} ${chunk}` : chunk)));

  const firstName = (user?.name || "").split(" ")[0] || "you";

  const insertPrompt = (p: string) => {
    setActivePrompt(p);
    setText((t) => (t ? `${t}\n\n${p}\n` : `${p}\n`));
  };

  const askNext = async () => {
    const res = await nextQ.mutateAsync({ soFar: text });
    if (!res.success) return toast.error(res.error ?? "Failed");
    insertPrompt(res.question || "Tell me something else about yourself.");
  };

  const buildPersona = async () => {
    if (text.trim().length < 30) return toast.error("Share a little more so we can capture who you are");
    if (speech.listening) speech.stop();
    const res = await build.mutateAsync({ narrative: text, name: user?.name ?? undefined });
    if (!res.success) return toast.error(res.error ?? "Failed");
    await utils.voice.getPersona.invalidate();
    await utils.voice.get.invalidate();
    await utils.resume.listProfiles.invalidate();
    toast.success("Saved. This now shapes how we write for you.");
  };

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <UserRound className="w-4 h-4 text-brand" />
        <h3 className="font-bold text-sm text-slate-800">Who is {firstName}?</h3>
        <span className="text-xs text-slate-400">the self behind the writing</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Describe yourself in your own words. Answer a prompt, write freely, or speak it aloud. This teaches us who you are, not just how you write, so your applications carry your character.
      </p>

      {/* Guided prompts */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => insertPrompt(p)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${activePrompt === p ? "bg-brand text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          >
            {p}
          </button>
        ))}
        <button onClick={askNext} disabled={nextQ.isPending} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-light text-brand hover:brightness-95 inline-flex items-center gap-1">
          {nextQ.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquareText className="w-3 h-3" />} Ask me something
        </button>
      </div>

      {/* Freeform / dictation box */}
      <div className="relative">
        <textarea
          value={text + (speech.interim ? ` ${speech.interim}` : "")}
          onChange={(e) => setText(e.target.value)}
          className="textarea min-h-[160px]"
          placeholder="Write about yourself here… or tap the mic and just talk. You can fix any wording after."
        />
        {speech.supported && (
          <button
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            className={`absolute bottom-3 right-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-all ${speech.listening ? "bg-rose-500 text-white animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            title={speech.listening ? "Stop recording" : "Record and transcribe"}
          >
            {speech.listening ? <><MicOff className="w-3.5 h-3.5" /> Stop</> : <><Mic className="w-3.5 h-3.5" /> Speak</>}
          </button>
        )}
      </div>
      {!speech.supported && (
        <p className="text-[11px] text-slate-400 mt-1">Voice input isn't available in this browser, use Chrome or Edge, or just type.</p>
      )}
      {speech.listening && <p className="text-[11px] text-rose-500 mt-1">Listening… speak naturally, then edit any errors before saving.</p>}

      <div className="flex items-center gap-2 mt-3">
        <button onClick={buildPersona} disabled={build.isPending} className="btn-primary">
          {build.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Capturing…</> : <><Wand2 className="w-4 h-4" /> Capture who I am</>}
        </button>
        <span className="text-[11px] text-slate-400">Your words only. We never invent things about you.</span>
      </div>

      {/* Saved persona */}
      {persona && (
        <div className="rounded-xl p-4 mt-4" style={{ background: "linear-gradient(135deg,#fff7ed,#fff)" }}>
          <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-brand" /><span className="font-bold text-xs text-slate-700">How we see you</span></div>
          <p className="text-sm text-slate-700 leading-relaxed">{persona.summary}</p>
          {persona.traits?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {persona.traits.map((t) => <span key={t} className="chip bg-brand-light text-brand">{t}</span>)}
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-3 mt-3">
            {([["Values", persona.values], ["Strengths", persona.strengths], ["Interests", persona.interests]] as const).map(([label, arr]) => (
              arr?.length ? (
                <div key={label}>
                  <div className="text-[11px] font-bold text-slate-500 mb-1">{label}</div>
                  <div className="flex flex-wrap gap-1">{arr.map((x) => <span key={x} className="chip bg-slate-100 text-slate-600">{x}</span>)}</div>
                </div>
              ) : null
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold mt-3"><Save className="w-3 h-3" /> Folded into your voice profile</div>
        </div>
      )}
    </div>
  );
}
