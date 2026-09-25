import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Learn how meepdf uses essential browser storage for privacy preferences.",
};

export default function CookiesPage() {
  return <main className="policy-shell"><header className="policy-header"><Link href="/" className="policy-brand"><span>m</span>meepdf</Link><Link href="/" className="policy-back">Back to tools</Link></header><article className="policy-content"><p className="policy-kicker">meepdf legal</p><h1>Cookie policy</h1><p className="policy-updated">Last updated September 25, 2026</p><p>meepdf does not require advertising or tracking cookies to provide its document tools.</p><h2>Essential local storage</h2><p>We may use browser local storage to remember your cookie choice and basic interface preferences. This data stays on your device and is not a document upload.</p><h2>Managing preferences</h2><p>Choose “Essential only” in the consent notice, or clear meepdf site data in your browser settings. Clearing site data may reset saved preferences and editor state.</p></article></main>;
}
