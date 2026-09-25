import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Document Editors",
  description: "Edit Word documents, spreadsheets, and presentations privately in your browser.",
};

export default function DocumentEditorLayout({ children }: { children: ReactNode }) {
  return children;
}
