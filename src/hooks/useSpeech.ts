import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Browser speech-to-text via the Web Speech API (free, on-device in Chrome/Edge).
 * Honest limits: not supported in all browsers (Firefox has none; Safari is
 * partial). Callers should check `supported` and offer a "type instead"
 * fallback. Transcripts are appended to whatever the user already has so they
 * can dictate, then edit errors before saving.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<any>(null);

  const SR =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined;
  const supported = !!SR;

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let final = "";
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else inter += t;
      }
      if (final) onFinal(final);
      setInterim(inter);
    };
    rec.onerror = () => { setListening(false); setInterim(""); };
    rec.onend = () => { setListening(false); setInterim(""); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { /* already started */ }
  }, [SR, onFinal]);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  return { supported, listening, interim, start, stop };
}
