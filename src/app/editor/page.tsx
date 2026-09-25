import type { Metadata } from "next";
import PdfViewer from "@/components/PdfViewer";

export const metadata: Metadata = {
  title: "Edit PDF",
  description: "Open, annotate, rearrange, sign, and export PDFs privately in your browser.",
};

export default function EditorPage() {
  return <PdfViewer />;
}
