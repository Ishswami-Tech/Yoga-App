// Single source of truth for branding / contact details.
// NEXT_PUBLIC_* values are inlined at build time, so this is safe in both
// server and client components.
export const APP_NAME: string = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Shree Vishwayog Ayurved";
// WhatsApp messages (login codes, reminders, receipts) are sent from, and replies are received by,
// Ishswami Tech's WhatsApp Business number, so this is the sender name students see.
export const WHATSAPP_SENDER_NAME = "Ishswami Tech";
export const SUPPORT_PHONE: string = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "";
export const SUPPORT_EMAIL: string = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";
