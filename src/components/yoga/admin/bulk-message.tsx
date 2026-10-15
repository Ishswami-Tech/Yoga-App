"use client";
import { usePlan } from "@/hooks/use-plan";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
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
  const plan = usePlan();
  const [message, setMessage] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [result, setResult] = useState<{
    recipientCount: number;
    sent: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const countQ = useQuery<{ count: number }>({
    queryKey: ["admin", "bulk-recipients", activeOnly],
    queryFn: () => apiGet<{ count: number }>(`/api/admin/bulk-message?activeOnly=${activeOnly}`),
  });

  const sendMut = useMutation({
    mutationFn: () =>
      apiPost("/api/admin/bulk-message", { message, activeOnly }),
    onSuccess: (res: any) => {
      setResult(res);
      countQ.refetch();
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

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Composer */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-bold">
                  Message
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message here… (e.g. 'Tomorrow's class starts 30 min early at 6:30 AM')"
                  className="min-h-[140px] resize-y rounded-2xl"
                  maxLength={maxLen}
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    WhatsApp text message — not a template.
                  </span>
                  <span className={remaining < 50 ? "text-primary font-medium" : "text-muted-foreground"}>
                    {remaining} characters left
                  </span>
                </div>
              </div>

              {/* Recipients toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-3.5 min-h-11">
                <div>
                  <p className="text-sm font-medium">Active members only</p>
                  <p className="text-xs text-muted-foreground">
                    Only send to members with an active {plan.display}/month membership
                  </p>
                </div>
                <Switch
                  checked={activeOnly}
                  onCheckedChange={setActiveOnly}
                />
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-2xl bg-marigold/15 border border-marigold/60 p-3.5 text-xs font-semibold text-foreground">
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
                size="lg" className="w-full"
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
          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center gap-2 font-display text-lg font-semibold">
                <Users className="h-4 w-4 text-primary" /> Recipients
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold text-primary">
                  {countQ.isLoading ? "…" : countQ.isError ? "—" : countQ.data?.count ?? 0}
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
            <Card className="border-success/30">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 font-display text-lg font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Result
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-success-soft p-3 text-center">
                    <CheckCircle2 className="h-4 w-4 text-success mx-auto mb-1" />
                    <p className="text-xl font-bold text-success">
                      {result.sent}
                    </p>
                    <p className="text-xs font-bold text-foreground">Sent</p>
                  </div>
                  <div className="rounded-2xl bg-accent p-3 text-center">
                    <XCircle className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold text-primary">
                      {result.failed}
                    </p>
                    <p className="text-xs font-bold text-foreground">Failed</p>
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
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" /> Preview
                </p>
                <div className="rounded-3xl rounded-tl-md bg-success-soft p-3.5 text-sm text-foreground">
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
