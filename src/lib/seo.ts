import { APP_NAME } from "@/lib/brand";

// Canonical public origin. NEXT_PUBLIC_APP_URL wins; the fallback is the live www host.
const FALLBACK_SITE_URL = "https://www.shreevishwayogayurved.com";

export const SITE_URL: string = (process.env.NEXT_PUBLIC_APP_URL?.trim() || FALLBACK_SITE_URL).replace(/\/+$/u, "");

export const SITE_TITLE = `${APP_NAME} — Daily Live Yoga Classes Online`;

export const SITE_DESCRIPTION =
  "Join daily live yoga classes online on Google Meet. Get a WhatsApp reminder before every class and a simple monthly membership you can cancel anytime.";

export const SITE_KEYWORDS: string[] = [
  APP_NAME,
  "live yoga classes online",
  "daily yoga classes",
  "online yoga membership",
  "yoga on Google Meet",
  "yoga with WhatsApp reminders",
  "Ayurved yoga",
];

/** schema.org structured data for the single public page. */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: APP_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: APP_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
}
