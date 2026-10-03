"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { apiPost } from "@/lib/api-client";
import { authClient } from "@/lib/better-auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  MessageCircle,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  User as UserIcon,
  Phone,
} from "lucide-react";

type Step = "identify" | "login" | "register" | "details";

export function AuthModal() {
  const { authOpen, closeAuth, set, setView } = useApp();
  const [step, setStep] = useState<Step>("identify");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userInfo, setUserInfo] = useState<any>(null);
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [reg, setReg] = useState({ name: "", email: "", password: "" });
  const [details, setDetails] = useState({ phone: "", whatsappNumber: "" });

  const goToHome = (user: any) => {
    set({ user, authOpen: null });
    setView(
      user?.role === "ADMIN" ? "admin-dashboard"
      : user?.role === "INSTRUCTOR" ? "instructor-dashboard"
      : "student-dashboard"
    );
  };

  const fetchMe = async () => {
    const me = await fetch("/api/auth/me", { credentials: "same-origin" }).then((r) => r.json());
    return me.user;
  };

  const handleIdentify = async () => {
    setLoading(true);
    try {
      const res = await apiPost("/api/auth/check", { email });
      if (res.exists) {
        setUserInfo({ name: res.name, hasWhatsapp: res.hasWhatsapp, whatsappNumber: res.whatsappNumber, hasPassword: res.hasPassword });
        setOtpPhone(res.whatsappNumber || "");
        setStep("login");
      } else {
        setReg({ ...reg, email });
        setStep("register");
      }
    } catch (e: any) { toast.error(e.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) { toast.error(result.error.message || "Login failed"); }
      else { toast.success(`Welcome back! 🧘`); goToHome(await fetchMe()); }
    } catch (e: any) { toast.error(e.message || "Login failed"); }
    finally { setLoading(false); }
  };

  const handleSendOtp = async () => {
    setLoading(true);
    try {
      const res = await apiPost("/api/auth/otp/send", { phone: otpPhone });
      toast.success("OTP sent via WhatsApp");
      setOtpSent(true); setDevCode(res.devCode ?? null);
    } catch (e: any) { toast.error(e.message || "Failed to send OTP"); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      const res = await apiPost("/api/auth/otp/verify", { phone: otpPhone, code: otpCode });
      toast.success("Welcome back! 🧘");
      goToHome(res.user);
    } catch (e: any) { toast.error(e.message || "Verification failed"); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const result = await authClient.signUp.email({ email: reg.email, password: reg.password, name: reg.name });
      if (result.error) { toast.error(result.error.message || "Sign up failed"); }
      else { toast.success("Account created! 🧘"); setStep("details"); }
    } catch (e: any) { toast.error(e.message || "Sign up failed"); }
    finally { setLoading(false); }
  };

  const handleSaveDetails = async () => {
    setLoading(true);
    try {
      const me = await fetchMe();
      await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: reg.name, phone: details.phone, whatsappNumber: details.whatsappNumber }) });
      toast.success("Profile complete! 🧘");
      goToHome({ ...me, name: reg.name, phone: details.phone, whatsappNumber: details.whatsappNumber });
    } catch (e: any) {
      toast.error("Couldn't save details, but you're logged in!");
      goToHome(await fetchMe());
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const cred = btoa(JSON.stringify({ email: "priya@student.demo", name: "Priya Sharma" }));
      const res = await apiPost("/api/auth/google", { credential: cred });
      toast.success("Welcome back! 🧘");
      goToHome(res.user);
    } catch (e: any) { toast.error(e.message || "Google login failed"); }
    finally { setLoading(false); }
  };

  const reset = () => { setStep("identify"); setEmail(""); setPassword(""); setOtpPhone(""); setOtpCode(""); setOtpSent(false); setDevCode(null); setUserInfo(null); setReg({ name: "", email: "", password: "" }); setDetails({ phone: "", whatsappNumber: "" }); };

  return (
    <Dialog open={!!authOpen} onOpenChange={(o) => { if (!o) { reset(); closeAuth(); } }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto scroll-soft">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="grid place-items-center h-8 w-8 rounded-full bg-brand-gradient text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="text-xl"><span className="text-brand-gradient">Prana</span> Live Yoga</DialogTitle>
          </div>
          <DialogDescription>Daily live classes · ₹500/month · Cancel anytime</DialogDescription>
        </DialogHeader>

        {step === "identify" && (
          <>
            <Button variant="outline" className="w-full" disabled={loading} onClick={handleGoogle}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
              Continue with Google
            </Button>
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email address</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && email.includes("@") && !loading) handleIdentify(); }} />
                <p className="text-[10px] text-muted-foreground">New here? We'll set up your account. Existing member? You'll log right in.</p>
              </div>
              <Button className="w-full bg-brand-gradient text-primary-foreground" disabled={loading || !email.includes("@")} onClick={handleIdentify}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </>
        )}

        {step === "login" && userInfo && (
          <div className="space-y-3">
            <button onClick={reset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium">Welcome back, {userInfo.name.split(" ")[0]}!</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </div>
            {userInfo.hasPassword ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter" && password.length >= 6 && !loading) handleLogin(); }} />
                </div>
                <Button className="w-full bg-brand-gradient text-primary-foreground" disabled={loading || password.length < 6} onClick={handleLogin}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">Sign in with WhatsApp below 👇</p>
            )}
            {userInfo.hasWhatsapp && (
              <>
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                    <span className="bg-background px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                  {!otpSent ? (
                    <Button variant="outline" className="w-full text-emerald-700 border-emerald-600/40 hover:bg-emerald-500/10" disabled={loading} onClick={handleSendOtp}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                      Login via WhatsApp OTP
                    </Button>
                  ) : (
                    <>
                      {devCode && (
                        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Your code (dev mode)</p>
                          <p className="text-xl font-bold text-amber-600 tracking-widest">{devCode}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input type="text" inputMode="numeric" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="text-center text-lg tracking-widest font-mono" autoFocus />
                        <Button className="bg-emerald-600 text-white hover:bg-emerald-700 shrink-0" disabled={loading || otpCode.length !== 6} onClick={handleVerifyOtp}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {step === "register" && (
          <div className="space-y-3">
            <button onClick={reset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <div className="flex items-center gap-3 rounded-lg bg-brand-gradient/5 border border-primary/20 p-3">
              <UserIcon className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Create your account</p>
                <p className="text-xs text-muted-foreground">{reg.email}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-name" className="text-xs">Full name</Label>
              <Input id="reg-name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="Priya Sharma" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-pw" className="text-xs">Choose a password</Label>
              <Input id="reg-pw" type="password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} placeholder="At least 6 characters"
                onKeyDown={(e) => { if (e.key === "Enter" && reg.name && reg.password.length >= 6 && !loading) handleRegister(); }} />
            </div>
            <Button className="w-full bg-brand-gradient text-primary-foreground" disabled={loading || !reg.name || reg.password.length < 6} onClick={handleRegister}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create account <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>
        )}

        {step === "details" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium">Account created! 🧘</p>
                <p className="text-xs text-muted-foreground">One last step — add your contact details.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="det-phone" className="text-xs flex items-center gap-1.5"><Phone className="h-3 w-3" /> Phone number</Label>
              <Input id="det-phone" type="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} placeholder="+91 90000 00000" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="det-wa" className="text-xs flex items-center gap-1.5"><MessageCircle className="h-3 w-3" /> WhatsApp number</Label>
              <Input id="det-wa" type="tel" value={details.whatsappNumber} onChange={(e) => setDetails({ ...details, whatsappNumber: e.target.value })} placeholder="+91 90000 00000" />
              <p className="text-[10px] text-muted-foreground">We'll send your class reminder 15 minutes before each session to this WhatsApp number.</p>
            </div>
            <Button className="w-full bg-brand-gradient text-primary-foreground" disabled={loading} onClick={handleSaveDetails}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Complete &amp; start <ArrowRight className="h-4 w-4" /></>}
            </Button>
            <button onClick={() => { fetchMe().then((u) => { toast.success("Skipping for now — you can add these later."); goToHome(u); }); }} className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition">
              Skip for now
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
