"use client";

import { useEffect, useState } from "react";

const CONSENT_KEY = "meepdf-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(window.localStorage.getItem(CONSENT_KEY) === null), []);
  const choose = (value: "accepted" | "essential") => {
    window.localStorage.setItem(CONSENT_KEY, value);
    setVisible(false);
  };
  if (!visible) return null;
  return <aside className="cookie-banner" role="dialog" aria-label="Cookie preferences">
    <div><strong>Privacy choices</strong><p>meepdf keeps your documents in your browser. We use only essential local storage for preferences and do not use advertising cookies.</p></div>
    <div className="cookie-actions"><a href="/privacy">Privacy policy</a><button className="cookie-button secondary" onClick={() => choose("essential")}>Essential only</button><button className="cookie-button primary" onClick={() => choose("accepted")}>Allow preferences</button></div>
  </aside>;
}
