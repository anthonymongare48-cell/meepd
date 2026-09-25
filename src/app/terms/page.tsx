import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Review the terms for using meepdf browser-based document tools.",
};

export default function TermsPage() {
  return <main className="policy-shell"><header className="policy-header"><Link href="/" className="policy-brand"><span>m</span>meepdf</Link><Link href="/" className="policy-back">Back to tools</Link></header><article className="policy-content"><p className="policy-kicker">meepdf legal</p><h1>Terms and conditions</h1><p className="policy-updated">Last updated September 25, 2026</p><p>By using meepdf, you agree to use the service lawfully and responsibly. You remain responsible for the files you open, edit, export, and share.</p><h2>Use of the service</h2><p>meepdf provides browser-based document utilities without requiring an account. Do not use the service to infringe rights, distribute malware, or process content you are not authorized to handle.</p><h2>Your content</h2><p>You retain your documents and are responsible for maintaining backups. Local browser processing can be affected by device memory, browser limits, corrupted files, or unsupported formats.</p><h2>Availability and limitations</h2><p>The service is provided on an “as available” basis. Results should be reviewed before relying on an exported document for legal, financial, safety-critical, or business decisions.</p><h2>Changes</h2><p>We may update these terms as the product changes. Continued use after an update means you accept the revised terms.</p></article></main>;
}
