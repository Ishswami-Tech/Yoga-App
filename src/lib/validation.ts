import { z } from "zod";
import { normalizeEmail } from "@/lib/email";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
// The WhatsApp number is the login identity; it can only be changed by an admin.
export const profileSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
});

// First-login profile completion for phone-only accounts. The email is normalised (trimmed,
// lowercased) and must be a real address, never the reserved placeholder domain.
export const profileCompleteSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80, "Name is too long"),
  email: z
    .string()
    .transform((v, ctx) => {
      const email = normalizeEmail(v);
      if (!email) {
        ctx.addIssue({ code: "custom", message: "Enter a valid email address" });
        return z.NEVER;
      }
      return email;
    }),
  acceptTerms: z.literal(true, { error: "You must accept the terms to continue" }),
});

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------
export const scheduleSchema = z.object({
  name: z.string().min(2),
  timezone: z.string().default("Asia/Kolkata"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm 24h format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm 24h format"),
  active: z.boolean().default(true),
  monday: z.boolean().default(true),
  tuesday: z.boolean().default(true),
  wednesday: z.boolean().default(true),
  thursday: z.boolean().default(true),
  friday: z.boolean().default(true),
  saturday: z.boolean().default(true),
  sunday: z.boolean().default(true),
});

export const exceptionSchema = z.object({
  scheduleId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  type: z.enum(["NO_CLASS", "SPECIAL"]).default("NO_CLASS"),
  reason: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Admin user management
// ---------------------------------------------------------------------------
export const adminUserUpdateSchema = z.object({
  role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  whatsappNumber: z.string().optional().nullable(),
});

export const settingsSchema = z.object({
  razorpayPlanId: z.string().optional(),
  // Ignored by the settings PUT: the price is managed via /api/admin/pricing.
  razorpayPlanAmount: z.number().optional(),
  razorpayPlanCurrency: z.string().default("INR"),
  whatsappTemplate: z.string().optional(),
  lookAheadDays: z.number().int().min(1).max(30).default(2),
  reminderMinutesBefore: z.number().int().min(1).max(180).default(15),
});
