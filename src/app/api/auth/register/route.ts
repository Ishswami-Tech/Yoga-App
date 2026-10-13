import { NextResponse } from "next/server";

export const runtime = "nodejs";

// This sign-in method has been removed: Vishwayog uses WhatsApp OTP only.
const gone = () =>
  NextResponse.json(
    { error: "This sign-in method is no longer available. Use WhatsApp sign-in.", code: "GONE" },
    { status: 410 }
  );

export const GET = gone;
export const POST = gone;
