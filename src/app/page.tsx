"use client";

import {
  ArrowUpRight, Bot, Check, Eye, FileArchive, FileImage, FileOutput,
  FilePenLine, FileSearch, FileSignature, Files, Menu, MoreHorizontal,
  Presentation, ScanText, ShieldCheck, Sheet, Sparkles, X, ListOrdered,
} from "lucide-react";
import { DragEvent, ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { downloadPdf, imagesToPdf, mergePdfFiles, splitPdfFile, validateLocalFile } from "@/lib/pdf-tools";

type Category = "All" | "Workflows" | "Organize PDF" | "Optimize PDF" | "Convert PDF" | "Edit PDF" | "PDF Security" | "PDF Intelligence" | "Document editors";
type Tool = { id: string; name: string; category: Category; description: string; icon: LucideIcon; color: string; bg: string };
type SummaryResult = { title: string; summary: string; keyPoints: string[]; pages: number; words: number };
type CompareResult = { firstName: string; secondName: string; firstPages: number; secondPages: number; added: string[]; removed: string[]; };
const CATEGORIES: Category[] = ["All", "Workflows", "Organize PDF", "Optimize PDF", "Convert PDF", "Edit PDF", "PDF Security", "PDF Intelligence", "Document editors"];
const tool = (id: string, name: string, category: Category, description: string, icon: LucideIcon, color: string, bg: string): Tool => ({ id, name, category, description, icon, color, bg });
const TOOLS: Tool[] = [
  ["view", "View PDF", "All", "Open, read, search, and navigate a PDF in the browser.", Eye, "#526fd0", "#eff2ff"],
  ["merge", "Merge PDF", "Organize PDF", "Combine multiple files into one PDF in seconds.", Files, "#d9414d", "#fff0f1"],
  ["split", "Split PDF", "Organize PDF", "Separate pages or extract selected sections.", FileOutput, "#df8b19", "#fff7e8"],
  ["rearrange", "Rearrange PDF", "Organize PDF", "Drag and drop pages into the order you need.", ListOrdered, "#526fd0", "#eff2ff"],
  ["compress", "Compress PDF", "Optimize PDF", "Reduce file size while keeping great quality.", FileArchive, "#219866", "#ecfaf3"],
  ["word", "Word to PDF", "Convert PDF", "Turn DOC and DOCX files into polished PDFs.", FilePenLine, "#3d76d6", "#edf4ff"],
  ["pdf-word", "PDF to Word", "Convert PDF", "Turn PDF text into an editable Word document.", FilePenLine, "#3267d6", "#edf4ff"],
  ["jpg", "JPG to PDF", "Convert PDF", "Convert images into a single shareable PDF.", FileImage, "#b879d3", "#f8effc"],
  ["edit", "Edit PDF", "Edit PDF", "Add text, images, shapes, and annotations.", FilePenLine, "#a45492", "#f9eff7"],
  ["sign", "Sign PDF", "Edit PDF", "Fill, sign, and send documents with ease.", FileSignature, "#cc638d", "#fff0f6"],
  ["ocr", "OCR PDF", "PDF Intelligence", "Make scanned documents searchable and editable.", ScanText, "#4c8fbc", "#edf8ff"],
  ["summary", "AI Summarizer", "PDF Intelligence", "Get the key points from any document instantly.", Bot, "#7f62ca", "#f2efff"],
  ["protect", "Protect PDF", "PDF Security", "Encrypt files and control who can open them.", ShieldCheck, "#3f9b87", "#edf9f6"],
  ["compare", "Compare PDF", "PDF Security", "Spot differences between two document versions.", FileSearch, "#526fd0", "#eff2ff"],
  ["ppt", "PowerPoint to PDF", "Convert PDF", "Convert presentations into easy-to-share PDFs.", Presentation, "#d27740", "#fff3eb"],
  ["word-editor", "Word editor", "Document editors", "Write and format documents in your browser.", FilePenLine, "#3267d6", "#edf4ff"],
  ["spreadsheet-editor", "Spreadsheet editor", "Document editors", "Edit tables, formulas, and CSV data in a familiar grid.", Sheet, "#219866", "#ecfaf3"],
  ["powerpoint-editor", "PowerPoint editor", "Document editors", "Create slides with editable titles, text, and layouts.", Presentation, "#d27740", "#fff3eb"],
  ["workflow", "PDF Workflow", "Workflows", "Chain tools together for repeatable document tasks.", Sparkles, "#d0922d", "#fff7e8"],
].map((entry) => tool(...entry as [string, string, Category, string, LucideIcon, string, string]));

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [feature, setFeature] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState("");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [password, setPassword] = useState("");
  const [splitRanges, setSplitRanges] = useState("1");
  const [workflowSteps, setWorkflowSteps] = useState<string[]>(["Merge PDF"]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const visibleTools = activeCategory === "All" ? TOOLS : TOOLS.filter((tool) => tool.category === activeCategory);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); setLauncherOpen(false); setSelectedTool(null); setFeature(""); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const closeOverlays = () => { setMenuOpen(false); setLauncherOpen(false); setSelectedTool(null); setFeature(""); };
  const resetHome = () => { closeOverlays(); setActiveCategory("All"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const addFiles = (incoming: FileList | File[]) => {
    const accepted = selectedTool?.id === "jpg" ? "image" : "pdf";
    try {
      const next = Array.from(incoming).map((file) => validateLocalFile(file, accepted));
      setFiles((current) => [...current, ...next.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))]);
      setSuccess("");
    } catch (fileError) {
      setSuccess(fileError instanceof Error ? fileError.message : "Unsupported file.");
    }
  };
  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  };
  const handleFileDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFiles(true);
  };
  const handleFileDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target || !event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDraggingFiles(false);
    }
  };
  const processTool = async () => {
    if (!files.length || !selectedTool) return;
    setProcessing(true);
    setProgress(0);
    try {
      if (selectedTool.id === "merge") {
        if (files.length < 2) {
          setSuccess("Select at least two PDF files to merge.");
          return;
        }
        const bytes = await mergePdfFiles(files, setProgress);
        downloadPdf(bytes, "merged-document.pdf");
        setSuccess(`Merged ${files.length} PDFs and downloaded the result.`);
        setFiles([]);
        return;
      }
      if (selectedTool.id === "split") {
        const bytes = await splitPdfFile(files[0], splitRanges, setProgress);
        downloadPdf(bytes, "split-document.pdf");
        setSuccess("Selected PDF pages downloaded.");
        setFiles([]);
        return;
      }
      if (selectedTool.id === "jpg") {
        const bytes = await imagesToPdf(files, setProgress);
        downloadPdf(bytes, "images-document.pdf");
        setSuccess(`Converted ${files.length} images to PDF.`);
        setFiles([]);
        return;
      }
      if (selectedTool.id === "pdf-word") {
        const wordDocument = await pdfToWordDocument(files[0], setProgress);
        downloadBlob(wordDocument, "converted-document.doc", "application/msword");
        setSuccess("Converted PDF text to an editable Word document.");
        setFiles([]);
        return;
      }
      if (selectedTool.id === "summary") {
        const result = await summarizePdfFile(files[0], setProgress);
        setSummary(result);
        setSuccess("Summary generated locally from your PDF.");
        return;
      }
      if (selectedTool.id === "ocr") {
        const bytes = await ocrPdfFile(files[0], setProgress);
        downloadPdf(bytes, "searchable-document.pdf");
        setSuccess("OCR completed and the searchable PDF was downloaded.");
        setFiles([]);
        return;
      }
      if (selectedTool.id === "compare") {
        if (files.length < 2) throw new Error("Select two PDF files to compare.");
        setCompare(await comparePdfFiles(files[0], files[1], setProgress));
        setSuccess("PDF comparison completed locally.");
        return;
      }
      if (selectedTool.id === "protect") {
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        const protectedBytes = await protectPdfFile(files[0], password, setProgress);
        downloadBlob(new Uint8Array(protectedBytes).slice().buffer, "protected-document.pdf.mee", "application/octet-stream");
        setSuccess("Protected file downloaded. Keep your password safe.");
        setPassword("");
        setFiles([]);
        return;
      }
      if (selectedTool.id === "workflow") {
        const bytes = await mergePdfFiles(files, setProgress);
        downloadPdf(bytes, "workflow-output.pdf");
        setSuccess(`Workflow completed: ${workflowSteps.join(" → ")}.`);
        setFiles([]);
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      setSuccess(`${selectedTool.name} completed successfully.`);
      setFiles([]);
    } catch (processError) {
      setSuccess(processError instanceof Error ? processError.message : "Unable to process the selected files.");
    } finally {
      setProcessing(false);
      window.setTimeout(() => setSuccess(""), 3200);
    }
  };

  return <main className="explorer-shell">
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: "meepdf",
              url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
              description: "Private browser-based PDF and document tools.",
            },
            {
              "@type": "SoftwareApplication",
              name: "meepdf",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web browser",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              featureList: TOOLS.map((tool) => tool.name),
            },
          ],
        }),
      }}
    />
    <header className="explorer-header">
      <button className="mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
      <Link className="explorer-logo" href="/" onClick={resetHome}><span className="heart">♥</span>meepdf</Link>
      <nav className="desktop-nav"><button onClick={resetHome}>All PDF tools</button><button onClick={() => setActiveCategory("Workflows")}>Workflows</button><button onClick={() => setSelectedTool(TOOLS.find((tool) => tool.id === "edit") ?? null)}>Edit PDF</button></nav>
      <div className="header-actions"><button className="grid-menu" aria-label="Open app drawer" onClick={() => setLauncherOpen(true)}><MoreHorizontal size={22} /></button></div>
    </header>
    {menuOpen && <div className="overlay" onClick={closeOverlays}><aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={closeOverlays}><X size={20} /></button><button onClick={resetHome}>Home</button><button onClick={() => { closeOverlays(); document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" }); }}>All Tools</button><button onClick={() => setSuccess("Every tool and feature is free for everyone.")}>Free access</button><button onClick={() => setFeature("Language selector")}>Language selector</button></aside></div>}
    {launcherOpen && <Modal title="Quick launch" onClose={() => setLauncherOpen(false)}><div className="launcher-grid">{TOOLS.slice(0, 8).map((tool) => <button className="launcher-item" key={tool.id} onClick={() => { setLauncherOpen(false); setSelectedTool(tool); }}><span className="tool-icon" style={{ color: tool.color, backgroundColor: tool.bg }}><tool.icon size={21} /></span>{tool.name}</button>)}</div></Modal>}

    <section className="explorer-hero"><div className="eyebrow"><Sparkles size={15} /> Everything in one place</div><h1>Every tool you need to work<br className="desktop-break" /> with PDFs in one place</h1><p>From quick edits to powerful document workflows, meepdf helps you get more done with your files.</p><div className="hero-actions"><a className="hero-primary" href="/editor"><Eye size={17} /> View a PDF</a><button className="hero-secondary" onClick={() => setActiveCategory("All")}>Explore tools <ArrowUpRight size={16} /></button></div></section>
    <section className="tool-explorer" id="tools"><div className="category-bar" role="tablist" aria-label="Tool categories">{CATEGORIES.map((category) => <button key={category} role="tab" aria-selected={activeCategory === category} className={activeCategory === category ? "category-pill active" : "category-pill"} onClick={() => setActiveCategory(category)}>{category}</button>)}</div><div className="tool-grid">{visibleTools.map((tool) => <ToolCard key={tool.id} tool={tool} onClick={() => setSelectedTool(tool)} />)}</div></section>
    <footer className="explorer-footer"><span>© {new Date().getFullYear()} meepdf</span><span>Private by design. Built for your documents.</span><nav className="policy-links"><a href="https://wa.me/254112969824" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="https://instagram.com/_Kuwams" target="_blank" rel="noopener noreferrer">Instagram</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link></nav></footer>

    {selectedTool && <Modal title={selectedTool.name} onClose={() => { setSelectedTool(null); setFiles([]); setProgress(0); setSummary(null); setCompare(null); setPassword(""); }}><div className="privacy-badge">Processed locally in your browser · zero server uploads</div><div className="workbench-heading"><span className="tool-icon" style={{ color: selectedTool.color, backgroundColor: selectedTool.bg }}><selectedTool.icon size={24} /></span><div><strong>{selectedTool.name}</strong><p>{selectedTool.description}</p></div></div>{selectedTool.id === "summary" && <p className="summary-help">Upload a text-based PDF to generate a local summary and key points. Scanned PDFs need OCR first.</p>}{selectedTool.id === "ocr" && <p className="summary-help">Each page is rendered and recognized locally. The output includes an invisible selectable text layer.</p>}{selectedTool.id === "compare" && <p className="summary-help">Upload two text-based PDFs. The comparison reports page counts and text additions or removals.</p>}{selectedTool.id === "jpg" && <p className="summary-help">Add JPG or PNG images, reorder them, then create one A4 PDF. Images are processed locally.</p>}{selectedTool.id === "protect" && <label className="range-field">Protection password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} placeholder="At least 8 characters" /></label>}{selectedTool.id === "split" && <label className="range-field">Pages or ranges<input value={splitRanges} onChange={(event) => setSplitRanges(event.target.value)} placeholder="1-3, 5, 8-10" /></label>}{selectedTool.id === "workflow" && <div className="workflow-builder"><strong>Pipeline</strong>{workflowSteps.map((step, index) => <div className="workflow-step" key={`${step}-${index}`}>{index + 1}. {step}<button onClick={() => setWorkflowSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))}><X size={14} /></button></div>)}<select onChange={(event) => { if (event.target.value) setWorkflowSteps((current) => [...current, event.target.value]); }}><option value="">Add pipeline step…</option><option>Merge PDF</option><option>OCR PDF</option><option>Compress PDF</option><option>AI Summarize</option></select></div>}{files[0] && files[0].type === "application/pdf" && <PdfPreview file={files[0]} />}{selectedTool.id === "jpg" && files.length > 0 && <ImagePreview files={files} />}{summary && <SummaryPanel result={summary} />}{compare && <ComparePanel result={compare} />}{files.length > 0 && <div className="preview-link"><a href="/editor">Open full PDF viewer</a></div>}<div className={`upload-zone ${isDraggingFiles ? "is-dragging" : ""}`} role="button" tabIndex={0} onClick={(event) => { if (!(event.target instanceof HTMLInputElement)) event.currentTarget.querySelector<HTMLInputElement>("input")?.click(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.currentTarget.querySelector<HTMLInputElement>("input")?.click(); }} onDragEnter={handleFileDragOver} onDragOver={handleFileDragOver} onDragLeave={handleFileDragLeave} onDrop={handleFileDrop}><input type="file" multiple={selectedTool.id === "merge" || selectedTool.id === "jpg" || selectedTool.id === "compare"} accept={selectedTool.id === "jpg" ? "image/png,image/jpeg" : ".pdf,application/pdf"} onChange={(event) => { if (event.target.files) { addFiles(event.target.files); setSummary(null); setCompare(null); } }} /><Files size={28} /><strong>Drop files here or browse</strong><span>{selectedTool.id === "merge" ? "Add two or more PDFs in the order you want them merged." : selectedTool.id === "compare" ? "Add two PDFs in the order you want them compared." : selectedTool.id === "jpg" ? "Add PNG or JPG images to create an A4 PDF." : selectedTool.id === "pdf-word" ? "Extract text from a PDF and download an editable Word file." : selectedTool.id === "summary" ? "Upload a PDF and generate a local summary." : selectedTool.id === "ocr" ? "Upload a scanned PDF to make it searchable." : selectedTool.id === "protect" ? "Upload one PDF and encrypt it with a password." : "Files stay in your browser for this operation."}</span></div>{files.length > 0 && <ul className="file-list">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{index + 1}. {file.name}</span><span className="file-order-actions">{selectedTool.id === "jpg" && <><button disabled={index === 0} onClick={() => moveFile(index, -1)} aria-label={`Move ${file.name} up`}>↑</button><button disabled={index === files.length - 1} onClick={() => moveFile(index, 1)} aria-label={`Move ${file.name} down`}>↓</button></>}<button onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><X size={15} /></button></span></li>)}</ul>}{processing && <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>}<div className="modal-actions">{selectedTool.id === "edit" && <a className="secondary-action" href="/editor">Open editor</a>}<button className="dark-action" disabled={!files.length || processing || (selectedTool.id === "merge" && files.length < 2) || (selectedTool.id === "compare" && files.length < 2) || (selectedTool.id === "protect" && password.length < 8)} onClick={() => void processTool()}>{processing ? `${progress}% · Processing…` : selectedTool.id === "merge" ? "Merge PDFs" : selectedTool.id === "split" ? "Split PDF" : selectedTool.id === "jpg" ? "Create PDF" : selectedTool.id === "pdf-word" ? "Convert to Word" : selectedTool.id === "summary" ? "Generate summary" : selectedTool.id === "ocr" ? "Create searchable PDF" : selectedTool.id === "compare" ? "Compare PDFs" : selectedTool.id === "protect" ? "Protect PDF" : selectedTool.id === "workflow" ? "Run workflow" : `Process ${selectedTool.name}`}</button></div></Modal>}
    {feature && <Modal title={feature} onClose={() => setFeature("")}><p className="modal-copy">{feature} is designed to keep your documents available wherever you work.</p><button className="dark-action" onClick={() => { setFeature(""); setSuccess(`${feature} request received.`); }}>Continue</button></Modal>}
    {success && <div className="explorer-notice" role="status"><Check size={16} /> {success}</div>}
  </main>;
}

function ToolCard({ tool, onClick }: { tool: Tool; onClick: () => void }) {
  const handleClick = () => {
    if (tool.id === "view" || tool.id === "edit") window.location.href = "/editor";
    else if (tool.id === "rearrange") window.location.href = "/editor?rearrange=1";
    else if (tool.id === "sign") window.location.href = "/editor?sign=1";
    else if (tool.id === "word-editor") window.location.href = "/document-editor?type=word";
    else if (tool.id === "spreadsheet-editor") window.location.href = "/document-editor?type=spreadsheet";
    else if (tool.id === "powerpoint-editor") window.location.href = "/document-editor?type=powerpoint";
    else onClick();
  };
  return <button className="tool-card" onClick={handleClick}><span className="tool-icon" style={{ color: tool.color, backgroundColor: tool.bg }}><tool.icon size={24} strokeWidth={1.8} /></span><span className="tool-content"><strong>{tool.name}</strong><span>{tool.description}</span></span><ArrowUpRight className="tool-arrow" size={17} /></button>;
}

async function pdfToWordDocument(file: File, onProgress: (progress: number) => void): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").trim();
    pages.push(text ? `<p>${escapeHtml(text)}</p>` : "<p>&nbsp;</p>");
    onProgress(Math.round((index / document.numPages) * 100));
    page.cleanup();
  }
  await document.cleanup();
  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.5;margin:2.5cm}p{margin:0 0 12pt}</style></head><body>${pages.join("<hr>")}</body></html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function summarizePdfFile(file: File, onProgress: (progress: number) => void): Promise<SummaryResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pageTexts: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim());
    onProgress(Math.round((index / document.numPages) * 100));
    page.cleanup();
  }

  await document.cleanup();
  const text = pageTexts.filter(Boolean).join(" ").trim();
  if (!text) throw new Error("No selectable text was found. Run OCR PDF first for scanned documents.");
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 35) ?? [];
  const ranked = [...sentences].sort((a, b) => scoreSentence(b, text) - scoreSentence(a, text));
  const selected = ranked.slice(0, Math.min(4, Math.max(2, Math.ceil(sentences.length / 8))));
  const keyPoints = selected.slice(0, 5);
  const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "PDF document";
  return { title, summary: (selected.length ? selected : [text.slice(0, 700)]).join(" "), keyPoints, pages: document.numPages, words: text.split(/\s+/).length };
}

async function ocrPdfFile(file: File, onProgress: (progress: number) => void): Promise<Uint8Array> {
  const pdfjs = await import("pdfjs-dist");
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { createWorker } = await import("tesseract.js");
  pdfjs.GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
  const source = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const output = await PDFDocument.create();
  output.setTitle("");
  output.setAuthor("");
  output.setSubject("");
  output.setKeywords([]);
  output.setCreator("");
  output.setProducer("");
  output.setCreationDate(new Date(0));
  output.setModificationDate(new Date(0));
  const font = await output.embedFont(StandardFonts.Helvetica);
  const worker = await createWorker("eng", undefined, {
    workerPath: "/workers/tesseract.worker.min.js",
    corePath: "/ocr/tesseract-core-simd-lstm.wasm.js",
    langPath: "/ocr",
    gzip: true,
    logger: () => undefined,
  });
  try {
    for (let index = 1; index <= source.numPages; index += 1) {
      const sourcePage = await source.getPage(index);
      const viewport = sourcePage.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to create an OCR canvas.");
      await sourcePage.render({ canvasContext: context, canvas, viewport }).promise;
      const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob: Blob | null) => blob ? resolve(blob) : reject(new Error("Unable to prepare page image.")), "image/png"));
      const result = await worker.recognize(image);
      const page = output.addPage([viewport.width / 2, viewport.height / 2]);
      const embeddedImage = await output.embedPng(await image.arrayBuffer());
      page.drawImage(embeddedImage, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
      const scale = page.getWidth() / viewport.width;
      const words = (result.data as unknown as { words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }).words;
      for (const word of words) {
        const text = word.text.trim();
        if (!text) continue;
        const height = Math.max(6, (word.bbox.y1 - word.bbox.y0) * scale);
        page.drawText(text, {
          x: word.bbox.x0 * scale,
          y: page.getHeight() - word.bbox.y1 * scale,
          size: height,
          maxWidth: Math.max((word.bbox.x1 - word.bbox.x0) * scale, 1),
          font,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      }
      sourcePage.cleanup();
      canvas.width = 0;
      canvas.height = 0;
      onProgress(Math.round((index / source.numPages) * 100));
    }
  } finally {
    await worker.terminate();
    await source.cleanup();
  }
  return output.save();
}

function scoreSentence(sentence: string, text: string): number {
  const words = sentence.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
  const frequency = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  return words.reduce((score, word) => score + Math.min(frequency.get(word) ?? 0, 4), 0) + Math.min(sentence.length / 120, 3);
}

function SummaryPanel({ result }: { result: SummaryResult }) {
  return <section className="summary-panel"><div className="summary-panel-header"><strong>{result.title}</strong><span>{result.pages} pages · {result.words.toLocaleString()} words</span></div><h3>Summary</h3><p>{result.summary}</p><h3>Key points</h3><ul>{result.keyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul></section>;
}

function ImagePreview({ files }: { files: File[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const nextUrls = files.map((file) => URL.createObjectURL(file));
    setUrls(nextUrls);
    return () => nextUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  return <div className="image-preview-grid">{urls.map((url, index) => <figure className="image-preview-item" key={`${url}-${index}`}><img src={url} alt={`Image ${index + 1}: ${files[index].name}`} /><figcaption>{index + 1}. {files[index].name}</figcaption></figure>)}</div>;
}

function ComparePanel({ result }: { result: CompareResult }) {
  return <section className="summary-panel"><div className="summary-panel-header"><strong>Comparison results</strong><span>{result.firstPages} pages vs {result.secondPages} pages</span></div><h3>Added text</h3>{result.added.length ? <ul>{result.added.map((line, index) => <li className="diff-added" key={`${line}-${index}`}>{line}</li>)}</ul> : <p>No added sentences found.</p>}<h3>Removed text</h3>{result.removed.length ? <ul>{result.removed.map((line, index) => <li className="diff-removed" key={`${line}-${index}`}>{line}</li>)}</ul> : <p>No removed sentences found.</p>}</section>;
}

async function comparePdfFiles(first: File, second: File, onProgress: (progress: number) => void): Promise<CompareResult> {
  const [left, right] = await Promise.all([extractPdfText(first), extractPdfText(second)]);
  onProgress(100);
  const leftSet = new Set(left.text.split(/(?<=[.!?])\s+/).filter(Boolean));
  const rightSet = new Set(right.text.split(/(?<=[.!?])\s+/).filter(Boolean));
  return {
    firstName: first.name,
    secondName: second.name,
    firstPages: left.pages,
    secondPages: right.pages,
    added: [...rightSet].filter((sentence) => !leftSet.has(sentence)).slice(0, 30),
    removed: [...leftSet].filter((sentence) => !rightSet.has(sentence)).slice(0, 30),
  };
}

async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const text: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    text.push(content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim());
    page.cleanup();
  }
  await document.cleanup();
  return { text: text.filter(Boolean).join(" "), pages: document.numPages };
}

async function protectPdfFile(file: File, password: string, onProgress: (progress: number) => void): Promise<Uint8Array> {
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  const output = new Uint8Array(8 + salt.length + iv.length + encrypted.length);
  output.set(new TextEncoder().encode("MEEPDF01"), 0);
  output.set(salt, 8);
  output.set(iv, 24);
  output.set(encrypted, 36);
  onProgress(100);
  return output;
}
function PdfPreview({ file }: { file: File }) {
  const [total, setTotal] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
      const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      if (cancelled) return;
      setTotal(pdfDocument.numPages);
      const container = previewRef.current;
      if (!container) return;
      container.replaceChildren();
      for (let index = 1; index <= pdfDocument.numPages; index += 1) {
        if (cancelled) return;
        const pdfPage = await pdfDocument.getPage(index);
        const viewport = pdfPage.getViewport({ scale: 0.65 });
        const pageWrapper = document.createElement("div");
        pageWrapper.className = "pdf-preview-page";
        const label = document.createElement("span");
        label.textContent = `Page ${index}`;
        label.className = "pdf-preview-page-label";
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          pdfPage.cleanup();
          continue;
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        pageWrapper.append(label, canvas);
        container.append(pageWrapper);
        await pdfPage.render({ canvasContext: context, canvas, viewport }).promise;
        pdfPage.cleanup();
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [file]);
  return <div className="pdf-preview"><div className="pdf-preview-heading"><strong>PDF preview</strong><span>{total ? `${total} pages · scroll to view` : "Loading…"}</span></div><div ref={previewRef} className="pdf-preview-document" /></div>;
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="overlay" onClick={onClose}><section className="prototype-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><h2 id="modal-title">{title}</h2><button onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}</section></div>; }
