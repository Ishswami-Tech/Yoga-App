import type { Metadata } from "next";
import { LegalPage, SupportContact } from "@/components/yoga/public/legal-page";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${APP_NAME} collects, uses and protects your personal information.`,
  alternates: { canonical: "/privacy" },
};

// TODO(owner): add the registered legal name and postal address of the operator
// (Ishswami Tech) and a grievance officer name/contact if required by Indian law.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what personal information {APP_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects when you use our live yoga membership, why we collect it, and the choices you have.
        The service is operated by Ishswami Tech in India.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Your name and WhatsApp number, which you give us when you create an account.</li>
        <li>Your email address, if you choose to provide one.</li>
        <li>Class attendance, such as which live classes you joined.</li>
        <li>
          Payment status, such as whether your membership is active, renewed or cancelled. Payments are
          processed by Razorpay. We never see or store your card, UPI or bank details.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To create your account and sign you in with a one-time code.</li>
        <li>To run your membership and give you access to live classes.</li>
        <li>To send reminders and service messages about your classes and payments.</li>
        <li>To take payments, handle renewals and answer support requests.</li>
        <li>To keep the service secure and prevent misuse.</li>
      </ul>

      <h2>WhatsApp messages</h2>
      <p>
        We send messages on WhatsApp for login codes, class reminders and payment receipts. These
        are service messages linked to your account. We do not use your number for unrelated
        advertising.
      </p>
      <p>
        Messages are sent from, and any replies you send to that WhatsApp number are received by,
        Ishswami Tech, which runs this service on our behalf. Ishswami Tech uses them only to answer
        your question or support request.
      </p>

      <h2>Who we share it with</h2>
      <p>We share only what is needed to run the service, with these providers:</p>
      <ul>
        <li>Razorpay, to process payments and recurring billing.</li>
        <li>Meta (WhatsApp Business), to deliver login codes and reminders.</li>
        <li>Google (Meet and Calendar), to host and schedule live classes.</li>
        <li>Our hosting and infrastructure providers, to store data and run the website.</li>
      </ul>
      <p>We do not sell your personal information. We may disclose information if required by law.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while your account is active and for a reasonable period afterwards
        to meet legal, tax and accounting obligations and to resolve disputes. After that we delete
        or anonymise it.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us to show you the information we hold about you, correct it, or delete your
        account and data. Contact us using the details below and we will respond within a reasonable
        time. Some payment records must be kept for legal reasons even after deletion.
      </p>

      <h2>Security</h2>
      <p>
        We use reasonable safeguards, including encrypted connections and access controls, to protect
        your information. No online service can be guaranteed completely secure.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The &ldquo;Last updated&rdquo; date above shows
        the latest version.
      </p>

      <h2>Contact us</h2>
      <p>
        For any privacy question or request, reach us at <SupportContact />.
      </p>
    </LegalPage>
  );
}
