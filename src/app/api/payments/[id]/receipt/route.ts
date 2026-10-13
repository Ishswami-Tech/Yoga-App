import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { run, notFound, fail } from "@/lib/api";
import { istDateString, prettyTime } from "@/lib/services/scheduling";

import { APP_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/brand";
export const runtime = "nodejs";

// Payment receipt — returns a self-contained, print-optimised HTML page
// (A4 page size, no external CSS, triggers the browser print dialog on load).
//
// Access control:
//   - The owning student can fetch their own receipt.
//   - Admins can fetch any receipt (they manage payments).
// Receipts are immutable once issued; the page reflects the Payment row at
// fetch time (so a refund would surface here too).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return fail("Unauthorized", 401, { code: "UNAUTHORIZED" });

    const { id } = await ctx.params;
    const payment = await db.payment.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!payment) return notFound("Payment");

    if (user.role !== "ADMIN" && payment.userId !== user.id) {
      return fail("Forbidden", 403, { code: "FORBIDDEN" });
    }

    const html = renderReceipt({
      receiptNo: payment.id.slice(-8).toUpperCase(),
      paymentId: payment.razorpayPaymentId,
      studentName: payment.user.name,
      studentEmail: payment.user.email,
      amountMinor: payment.amount,
      currency: payment.currency,
      status: payment.status,
      gatewayFee: payment.gatewayFee,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      today: istDateString(new Date()),
    });

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
}

function esc(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function fmt(paise: number): string {
  return (paise / 100).toFixed(2);
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d) + " IST";
}

function renderReceipt(opts: {
  receiptNo: string;
  paymentId: string;
  studentName: string;
  studentEmail: string;
  amountMinor: number;
  currency: string;
  status: string;
  gatewayFee: number;
  paidAt: Date | null;
  createdAt: Date;
  today: string;
}): string {
  const amount = fmt(opts.amountMinor);
  const fee = fmt(opts.gatewayFee);
  const statusLabel =
    opts.status === "CAPTURED" ? "Paid" : opts.status === "REFUNDED" ? "Refunded" : opts.status;
  const statusColor = opts.status === "CAPTURED" ? "#059669" : "#dc2626";
  const paidAtStr = fmtDate(opts.paidAt) || fmtDate(opts.createdAt);
  const isPaid = opts.status === "CAPTURED";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${APP_NAME} — Receipt #${opts.receiptNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 14mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f2937; background: #fff; padding: 24px; max-width: 800px; margin: 0 auto;
  }
  .receipt {
    border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  }
  .receipt-head {
    background: linear-gradient(135deg, #0f766e 0%, #11856b 50%, #064e3b 100%);
    color: #fff; padding: 32px 32px 28px; position: relative;
  }
  .receipt-head::after {
    content: ""; position: absolute; right: -40px; top: -40px; width: 160px; height: 160px;
    background: rgba(255,255,255,0.08); border-radius: 50%;
  }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .brand-mark {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(255,255,255,0.15); display: grid; place-items: center;
    font-size: 18px;
  }
  .brand-name { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
  .receipt-title { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  .receipt-sub { font-size: 13px; opacity: 0.85; }
  .receipt-no {
    margin-top: 16px; display: inline-block; padding: 4px 10px; font-size: 12px;
    background: rgba(255,255,255,0.18); border-radius: 999px; letter-spacing: 0.04em;
  }
  .receipt-body { padding: 28px 32px; }
  .status-pill {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
    border-radius: 999px; font-size: 12px; font-weight: 600;
    color: ${statusColor}; background: ${statusColor}1a;
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: ${statusColor}; }
  .pay-amount {
    margin: 20px 0 28px; padding: 18px 20px; border-radius: 12px;
    background: #f6f8f7; border: 1px dashed #d1d5db;
  }
  .pay-amount .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; }
  .pay-amount .value { font-size: 36px; font-weight: 700; color: #0f766e; margin-top: 2px; }
  .pay-amount .value small { font-size: 16px; color: #6b7280; font-weight: 500; margin-left: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  tr td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
  tr td:first-child { color: #6b7280; }
  tr td:last-child { text-align: right; font-weight: 500; color: #111827; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
  tr.total td { border-top: 2px solid #0f766e; border-bottom: 0; padding-top: 14px; font-size: 16px; font-weight: 700; color: #0f766e; }
  tr.total td:last-child { font-family: inherit; font-size: 16px; }
  .receipt-foot {
    padding: 22px 32px 28px; background: #f9fafb; border-top: 1px solid #e5e7eb;
    font-size: 12px; color: #6b7280; line-height: 1.6;
  }
  .receipt-foot strong { color: #374151; }
  .actions {
    position: fixed; top: 16px; right: 16px; display: flex; gap: 8px;
  }
  .btn {
    padding: 8px 16px; border-radius: 8px; border: 0; cursor: pointer;
    font-size: 13px; font-weight: 600; color: #fff; background: #0f766e;
  }
  .btn.secondary { background: #fff; color: #374151; border: 1px solid #d1d5db; }
  @media print {
    .actions { display: none; }
    body { padding: 0; }
    .receipt { border: 0; box-shadow: none; border-radius: 0; }
  }
</style>
</head>
<body onload="setTimeout(() => window.print(), 400)">
  <div class="actions">
    <button class="btn" onclick="window.print()">Print / Save PDF</button>
    <button class="btn secondary" onclick="window.close()">Close</button>
  </div>
  <div class="receipt">
    <div class="receipt-head">
      <div class="brand">
        <div class="brand-mark">🧘</div>
        <div class="brand-name">${APP_NAME}</div>
      </div>
      <div class="receipt-title">Payment Receipt</div>
      <div class="receipt-sub">Monthly membership (₹${amount}) · Daily live yoga classes</div>
      <div class="receipt-no">RECEIPT #${opts.receiptNo}</div>
    </div>
    <div class="receipt-body">
      <div class="status-pill">
        <span class="status-dot"></span>
        ${statusLabel}
      </div>
      <div class="pay-amount">
        <div class="label">Amount ${isPaid ? "paid" : ""}</div>
        <div class="value">₹${amount} <small>${opts.currency}</small></div>
      </div>
      <table>
        <tr><td>Receipt number</td><td>${opts.receiptNo}</td></tr>
        <tr><td>Razorpay payment ID</td><td>${esc(opts.paymentId)}</td></tr>
        <tr><td>Member name</td><td style="font-family: inherit; font-size: 14px;">${esc(opts.studentName)}</td></tr>
        <tr><td>Member email</td><td style="font-family: inherit; font-size: 14px;">${esc(opts.studentEmail)}</td></tr>
        <tr><td>Payment date</td><td style="font-family: inherit; font-size: 14px;">${paidAtStr}</td></tr>
        <tr><td>Gateway fee</td><td>₹${fee}</td></tr>
        <tr><td>Amount</td><td>₹${amount}</td></tr>
        <tr class="total"><td>Total</td><td>₹${amount} ${opts.currency}</td></tr>
      </table>
    </div>
    <div class="receipt-foot">
      <strong>Thank you for practising with ${APP_NAME}.</strong><br/>
      This receipt is issued electronically for the membership period covered by the payment above.
      Membership remains active until the end of the current billing cycle.
      ${SUPPORT_EMAIL || SUPPORT_PHONE ? `For questions, contact ${[SUPPORT_EMAIL, SUPPORT_PHONE].filter(Boolean).join(" / ")}.` : ""}<br/><br/>
      Generated on ${fmtDate(new Date())} · Receipt ID ${opts.receiptNo} · Payment ID ${esc(opts.paymentId)}
    </div>
  </div>
  <script>
    // Close-after-print convenience (works in Chrome when opened via a popup)
    window.addEventListener('afterprint', function () { /* keep open so user can re-print */ });
  </script>
</body>
</html>`;
}
