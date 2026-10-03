import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  phone: z
    .string()
    .regex(/^[0-9+\-\s]{8,15}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  whatsappNumber: z
    .string()
    .regex(/^[0-9+\-\s]{8,15}$/, "Invalid WhatsApp number")
    .optional()
    .or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]).default("STUDENT"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const profileSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  whatsappNumber: z.string().optional().nullable(),
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
  razorpayPlanAmount: z
    .number()
    .int()
    .min(0)
    .optional(),
  razorpayPlanCurrency: z.string().default("INR"),
  whatsappTemplate: z.string().optional(),
  lookAheadDays: z.number().int().min(1).max(30).default(2),
  reminderMinutesBefore: z.number().int().min(1).max(180).default(15),
});
