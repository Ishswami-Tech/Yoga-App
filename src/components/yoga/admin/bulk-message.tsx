"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiPost, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "./shared";

export function BulkMessageView() {
  const [message, setMessage] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [result, setResult] = useState<{
    recipientCount: number;
    sent: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const sendMut = useMutation({
    mutationFn: () =>
      apiPost("/api/admin/bulk-message", { message, activeOnly }),
    onSuccess: (res: any) => {
      setResult(res);
      toast.success(`Message sent to ${res.sent} member${res.sent === 1 ? "" : "s"}`, {
        description: res.failed > 0 ? `${res.failed} failed` : undefined,
      });
    },
    onError: (e: ApiError) => {
      toast.error("Couldn't send bulk message", { description: e.message });
    },
  });

  const maxLen = 1000;
  const remaining = maxLen - message.length;
  const canSend = message.trim().length > 0 && remaining >= 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bulk message"
        description="Send a custom WhatsApp message to all active members. Use sparingly."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {/* Composer */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-semibold">
                  Message
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message here… (e.g. 'Tomorrow's class starts 30 min early at 6:30 AM')"
                  className="min-h-[140px] resize-y"
                  maxLength={maxLen}
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    WhatsApp text message — not a template.
                  </span>
                  <span className={remaining < 50 ? "text-rose-600 font-medium" : "text-muted-foreground"}>
                    {remaining} characters left
                  </span>
                </div>
              </div>

              {/* Recipients toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Active members only</p>
                  <p className="text-xs text-muted-foreground">
                    Only send to members with an active ₹500/month membership
                  </p>
                </div>
                <Switch
                  checked={activeOnly}
                  onCheckedChange={setActiveOnly}
                />
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  This sends a real WhatsApp message to every recipient.
                  In production, custom text messages require a 24-hour
                  customer service window. Use this for important
                  announcements only.
                </p>
              </div>

              {/* Send button */}
              <Button
                className="w-full bg-brand-gradient text-primary-foreground"
                disabled={!canSend || sendMut.isPending}
                onClick={() => sendMut.mutate()}
              >
                {sendMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Send to {activeOnly ? "active" : "all"} members
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Recipients preview */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" /> Recipients
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-brand-gradient">
                  {activeOnly ? "2" : "4"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {activeOnly ? "active" : "total"} members
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Members without a WhatsApp number are automatically skipped.
              </p>
            </CardContent>
          </Card>

          {/* Result */}
          {result && (
            <Card className="border-emerald-500/30">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Result
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-emerald-500/10 p-2.5 text-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                      {result.sent}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Sent</p>
                  </div>
                  <div className="rounded-lg bg-rose-500/10 p-2.5 text-center">
                    <XCircle className="h-4 w-4 text-rose-600 mx-auto mb-1" />
                    <p className="text-xl font-bold text-rose-700 dark:text-rose-300">
                      {result.failed}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Failed</p>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Errors:</p>
                    {result.errors.map((e, i) => (
                      <p key={i} className="truncate">{e}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Message preview */}
          {message && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" /> Preview
                </p>
                <div className="rounded-2xl rounded-tl-sm bg-emerald-500/10 p-3 text-sm">
                  {message}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  How the message appears in WhatsApp
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
