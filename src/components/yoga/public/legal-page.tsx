import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/yoga/brand-logo";
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/brand";

export const LEGAL_LAST_UPDATED = "15 October 2026";

/** Renders the support contact details, only the ones that are configured. */
export function SupportContact() {
  if (!SUPPORT_EMAIL && !SUPPORT_PHONE) {
    return <>our support team through the contact options on our website</>;
  }
  return (
    <>
      {SUPPORT_EMAIL && (
        <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      )}
      {SUPPORT_EMAIL && SUPPORT_PHONE && " or "}
      {SUPPORT_PHONE && <span>{SUPPORT_PHONE}</span>}
    </>
  );
}

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="w-full bg-secondary/90 shadow-[0_6px_20px_-12px_rgb(59_31_26/0.35)]">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link
            href="/"
            className="flex items-center gap-3 group min-h-11"
            aria-label={`${APP_NAME} home`}
          >
            <BrandLogo size={52} className="group-hover:scale-105 transition" priority />
            <span className="font-display text-2xl font-semibold tracking-tight">
              <span className="text-brand-gradient">{APP_NAME}</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-10">
        <article className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold hover:text-primary transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <h1 className="font-display text-4xl font-semibold tracking-tight mt-4">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {LEGAL_LAST_UPDATED}</p>
          <div className="mt-8 space-y-4 text-base leading-7 text-foreground [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
            {children}
          </div>
        </article>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  );
}
