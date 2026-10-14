"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { SessionUser } from "@/lib/store";
import { RESEND_SECONDS } from "./code-step";

type Options = {
  sendUrl: string;
  verifyUrl: string;
  /** Builds the request body for the given (optional) code. */
  body: (code?: string) => object;
  canSend: boolean;
  onUser: (user: SessionUser) => void;
};

/** State machine shared by the phone and email sign-in flows. */
export function useCodeFlow({ sendUrl, verifyUrl, body, canSend, onUser }: Options) {
  const [step, setStep] = useState<"input" | "code">("input");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const send = async () => {
    if (!canSend || loading) return;
    setLoading(true); setError(null);
    try {
      await apiPost(sendUrl, body());
      setStep("code"); setCode(""); setCountdown(RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't send the code. Please try again.");
    } finally { setLoading(false); }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || loading) return;
    setLoading(true); setError(null);
    try {
      const res = await apiPost<{ user: SessionUser }>(verifyUrl, body(value));
      onUser(res.user);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Verification failed. Please try again.");
      setCode("");
    } finally { setLoading(false); }
  };

  const back = () => { setStep("input"); setCode(""); setError(null); };
  const changeCode = (v: string) => { setCode(v); if (error) setError(null); };

  return { step, code, loading, error, countdown, send, verify, back, changeCode };
}
