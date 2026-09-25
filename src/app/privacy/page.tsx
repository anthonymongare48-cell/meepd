import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read how meepdf protects privacy while processing documents locally in your browser.",
};
import type { ReactNode } from "react";

export default function PrivacyPage() {
  return <PolicyLayout title="Privacy policy" updated="September 25, 2026">
    <p>meepdf is designed to process documents locally in your browser. Unless a feature explicitly says otherwise, PDF, Word, spreadsheet, and presentation files are not uploaded to meepdf servers.</p>
    <h2>Information we process</h2>
    <p>Document bytes, editor content, and temporary previews are held in your device memory while you use a tool. Preferences such as cookie consent may be stored in your browser&apos;s local storage.</p>
    <h2>How we use information</h2>
    <p>Local information is used to provide the requested editor, remember your preferences, and improve the reliability of the application. We do not sell document content or use it for advertising profiles.</p>
    <h2>Security and retention</h2>
    <p>Local processing reduces server exposure, but you should still use an up-to-date browser and avoid sharing exported files or download links publicly. Closing the page or clearing browser data removes temporary local content.</p>
    <h2>Your choices</h2>
    <p>You can select “Essential only” in the cookie notice. You can also clear site data in your browser settings to remove saved preferences.</p>
  </PolicyLayout>;
}

function PolicyLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <main className="policy-shell"><header className="policy-header"><Link href="/" className="policy-brand"><span>m</span>meepdf</Link><Link href="/" className="policy-back">Back to tools</Link></header><article className="policy-content"><p className="policy-kicker">meepdf legal</p><h1>{title}</h1><p className="policy-updated">Last updated {updated}</p>{children}</article></main>;
}
