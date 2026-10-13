// Meta WhatsApp Business Cloud API adapter.
//
// With META_WA_ACCESS_TOKEN and META_WA_PHONE_NUMBER_ID set, this module calls
//   POST https://graph.facebook.com/v20.0/{phone_number_id}/messages
// with a Bearer token (META_WA_ACCESS_TOKEN) and a template namespace.
// Messages are only sent to eligible members and the provider message ID
// and status are persisted on WhatsAppMessage.
//
// Without those env vars nothing is sent: sends return FAILED / NOT_CONFIGURED.

import { createHash } from "crypto";

export const WHATSAPP_TEMPLATE_NAME = "yoga_class_reminder_v1";
export const WHATSAPP_LANGUAGE = "en";

export type SendReminderInput = {
  toWhatsapp: string;
  templateName: string;
  studentName: string;
  classTime: string; // "07:00"
  meetUrl: string;
  className: string;
};

export type WhatsAppSendResult = {
  providerMessageId: string;
  status: "SENT" | "DELIVERED" | "FAILED";
  errorCode?: string;
  errorMessage?: string;
};

function liveConfig(): { token: string; phoneNumberId: string } | null {
  const token = process.env.META_WA_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID?.trim();
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

// Meta wants digits only, with country code and no "+".
function toE164Digits(n: string): string {
  return n.replace(/[^0-9]/g, "");
}

async function sendLive(
  input: SendReminderInput,
  cfg: { token: string; phoneNumberId: string }
): Promise<WhatsAppSendResult> {
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164Digits(input.toWhatsapp),
        type: "template",
        template: {
          name: input.templateName || WHATSAPP_TEMPLATE_NAME,
          language: { code: WHATSAPP_LANGUAGE },
          // The approved template body takes three variables, in this order:
          // {{1}} student name, {{2}} class time, {{3}} Meet link.
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: input.studentName },
                { type: "text", text: input.classTime },
                { type: "text", text: input.meetUrl },
              ],
            },
          ],
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      messages?: { id?: string }[];
      error?: { code?: number; message?: string };
    } | null;
    const id = data?.messages?.[0]?.id;
    if (!res.ok || !id) {
      return {
        providerMessageId: "",
        status: "FAILED",
        errorCode: String(data?.error?.code ?? res.status),
        errorMessage: data?.error?.message ?? `WhatsApp API returned ${res.status}`,
      };
    }
    return { providerMessageId: id, status: "SENT" };
  } catch (e) {
    return {
      providerMessageId: "",
      status: "FAILED",
      errorCode: "NETWORK",
      errorMessage: e instanceof Error ? e.message : "WhatsApp request failed",
    };
  }
}

export const whatsapp = {
  get isMock(): boolean {
    return liveConfig() === null;
  },

  async sendClassReminder(
    input: SendReminderInput
  ): Promise<WhatsAppSendResult> {
    const live = liveConfig();
    if (!input.toWhatsapp || toE164Digits(input.toWhatsapp).length < 8) {
      return {
        providerMessageId: "",
        status: "FAILED",
        errorCode: "INVALID_RECIPIENT",
        errorMessage: "No WhatsApp number on file for this student",
      };
    }
    if (!live) {
      return {
        providerMessageId: "",
        status: "FAILED",
        errorCode: "NOT_CONFIGURED",
        errorMessage: "WhatsApp is not configured (META_WA_ACCESS_TOKEN / META_WA_PHONE_NUMBER_ID missing)",
      };
    }
    return sendLive(input, live);
  },

  // Sends a login code with the approved AUTHENTICATION template
  // (body {{1}} = code, plus the copy-code button). Never logs the code.
  async sendOtp(input: { to: string; code: string }): Promise<WhatsAppSendResult> {
    const live = liveConfig();
    if (!live) {
      console.warn("[whatsapp] OTP not sent: META_WA_ACCESS_TOKEN / META_WA_PHONE_NUMBER_ID are not set");
      return {
        providerMessageId: "",
        status: "FAILED",
        errorCode: "NOT_CONFIGURED",
        errorMessage: "WhatsApp is not configured",
      };
    }
    const to = toE164Digits(input.to);
    if (to.length < 8) {
      return { providerMessageId: "", status: "FAILED", errorCode: "INVALID_RECIPIENT", errorMessage: "Invalid number" };
    }
    const name = process.env.META_WA_OTP_TEMPLATE?.trim() || "otp_login";
    const language = process.env.META_WA_OTP_LANGUAGE?.trim() || "en";
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${live.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${live.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name,
            language: { code: language },
            components: [
              { type: "body", parameters: [{ type: "text", text: input.code }] },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: input.code }],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => null)) as {
        messages?: { id?: string }[];
        error?: { code?: number; message?: string };
      } | null;
      const id = data?.messages?.[0]?.id;
      if (!res.ok || !id) {
        return {
          providerMessageId: "",
          status: "FAILED",
          errorCode: String(data?.error?.code ?? res.status),
          errorMessage: data?.error?.message ?? `WhatsApp API returned ${res.status}`,
        };
      }
      return { providerMessageId: id, status: "SENT" };
    } catch (e) {
      return {
        providerMessageId: "",
        status: "FAILED",
        errorCode: "NETWORK",
        errorMessage: e instanceof Error ? e.message : "WhatsApp request failed",
      };
    }
  },

  // Render the approved template body for previews/logs.
  renderTemplate(input: SendReminderInput): string {
    return [
      "🧘 Yoga Class Reminder",
      `Hello ${input.studentName}, today's yoga class starts at ${input.classTime}.`,
      `Join your live class: ${input.meetUrl}`,
      "See you soon! 🙏",
    ].join("\n");
  },

  hashPayload(payload: string): string {
    return createHash("sha256").update(payload).digest("hex");
  },
};
