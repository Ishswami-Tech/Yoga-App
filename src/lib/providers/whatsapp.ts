// Meta WhatsApp Business Cloud API adapter.
//
// In production this module calls
//   POST https://graph.facebook.com/v20.0/{phone_number_id}/messages
// with a Bearer token (META_WA_ACCESS_TOKEN) and a template namespace.
// Messages are only sent to eligible members and the provider message ID
// and status are persisted on WhatsAppMessage.
//
// In this sandbox we synthesise a provider message ID and immediately mark
// the message as DELIVERED so the reminder job and WhatsApp logs can be
// exercised end-to-end.

import { createHash, randomBytes } from "crypto";

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

export const whatsapp = {
  isMock: true,

  async sendClassReminder(
    input: SendReminderInput
  ): Promise<WhatsAppSendResult> {
    if (!input.toWhatsapp || input.toWhatsapp.length < 8) {
      return {
        providerMessageId: "",
        status: "FAILED",
        errorCode: "INVALID_RECIPIENT",
        errorMessage: "No WhatsApp number on file for this student",
      };
    }

    // Simulate a tiny failure rate so the retry job has work to do.
    const fail = Math.random() < 0.05;
    if (fail) {
      return {
        providerMessageId: "",
        status: "FAILED",
        errorCode: "PROVIDER_5XX",
        errorMessage: "Meta WhatsApp transient error (simulated)",
      };
    }

    const providerMessageId = "wamid." + randomBytes(12).toString("hex");
    // Provider would normally return SENT; we fast-forward to DELIVERED.
    return {
      providerMessageId,
      status: "DELIVERED",
    };
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
