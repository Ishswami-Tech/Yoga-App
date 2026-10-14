import type { Metadata } from "next";
import { LegalPage, SupportContact } from "@/components/yoga/public/legal-page";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `The terms that apply when you use ${APP_NAME} and its live yoga membership.`,
  alternates: { canonical: "/terms" },
};

// TODO(owner): add the registered legal name/address of the operator and the
// specific court city for jurisdiction once confirmed with a lawyer.
export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        By creating an account or using {APP_NAME}, you agree to these terms. The service is
        operated by Ishswami Tech in India. If you do not agree, please do not use the service.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 18 years old, or use the service with the involvement of a parent or
        guardian. You must provide accurate details when you sign up.
      </p>

      <h2>Your account and login</h2>
      <p>
        You sign in with your WhatsApp number using a one-time code that we send you. Keep your
        phone and codes private. You are responsible for activity on your account, and you should
        tell us promptly if you think someone else has accessed it.
      </p>

      <h2>Membership and billing</h2>
      <p>
        {APP_NAME} is a monthly membership that gives you access to daily live yoga classes. The
        price is shown at checkout before you pay. Payments are processed securely by Razorpay.
      </p>
      <p>
        Your membership renews automatically each month. By subscribing you authorise us to charge
        your chosen payment method every month until you cancel. You will receive a payment receipt
        for each charge.
      </p>

      <h2>Cancellation</h2>
      <p>
        You can cancel at any time. Cancelling stops future renewals, and you keep access until the
        end of the period you have already paid for. See our Refund Policy for details.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not share your account or class links with people who have not joined.</li>
        <li>Do not record, copy or redistribute classes without our written permission.</li>
        <li>Be respectful to instructors and other members during classes.</li>
        <li>Do not misuse, disrupt or attempt to break into the service.</li>
      </ul>
      <p>We may suspend or end access if these rules are broken.</p>

      <h2>Health disclaimer</h2>
      <p>
        Yoga classes are for general wellbeing and are not medical advice, diagnosis or treatment.
        Speak to a qualified doctor before starting, especially if you have a medical condition, are
        pregnant, or have an injury. Take part at your own risk and stop if you feel pain or
        discomfort.
      </p>

      <h2>Availability</h2>
      <p>
        Classes run on Google Meet and reminders are sent on WhatsApp. These depend on third-party
        services and your internet connection. We aim to run classes as scheduled, but timings can
        change and we cannot guarantee uninterrupted service.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, we are not liable for indirect or consequential loss, or for
        any injury arising from your participation in classes. Our total liability for any claim is
        limited to the amount you paid for the membership in the month the claim relates to.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India. Disputes are subject to the courts in India
        with proper jurisdiction.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The &ldquo;Last updated&rdquo; date above shows
        the latest version. Continuing to use the service after a change means you accept it.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about these terms? Reach us at <SupportContact />.
      </p>
    </LegalPage>
  );
}
