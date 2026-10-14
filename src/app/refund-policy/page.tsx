import type { Metadata } from "next";
import { LegalPage, SupportContact } from "@/components/yoga/public/legal-page";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy",
  description: `How to cancel your ${APP_NAME} membership and when refunds are given.`,
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Cancellation & Refund Policy">
      <p>
        This policy explains how to cancel your {APP_NAME} membership and when we give refunds.
      </p>

      <h2>Cancelling your membership</h2>
      <p>
        You can cancel at any time. Cancelling stops all future renewals, so you will not be charged
        again. You keep access to live classes until the end of the period you have already paid
        for.
      </p>

      <h2>When we give refunds</h2>
      <p>We do not refund a month that has already started simply because you chose not to attend. We do refund in these cases:</p>
      <ul>
        <li>You were charged twice for the same period (duplicate charge).</li>
        <li>You were charged by mistake or an incorrect amount was taken (erroneous charge).</li>
        <li>You paid for a class period that we were unable to deliver.</li>
      </ul>

      <h2>How to request a refund</h2>
      <p>
        Contact us at <SupportContact /> within 7 days of the charge, with the phone number on your
        account and the payment details. We will review your request and reply with the outcome.
      </p>

      <h2>How refunds are paid</h2>
      <p>
        Approved refunds go back to the original payment method (the card, UPI or bank account used
        to pay). They usually reach you within 5 to 7 working days, depending on your bank.
      </p>

      <h2>Questions</h2>
      <p>
        If anything here is unclear, get in touch at <SupportContact /> and we will help.
      </p>
    </LegalPage>
  );
}
