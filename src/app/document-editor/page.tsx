"use client";

import { ArrowLeft, Download, FileText, FolderOpen, Grid3X3, Plus, Presentation, Save, Trash2, Underline } from "lucide-react";
import { Dispatch, DragEvent, SetStateAction, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { validateLocalFile } from "@/lib/pdf-tools";

type EditorType = "word" | "spreadsheet" | "powerpoint";
type Slide = { title: string; body: string };
type Cell = string[][];

const EDITOR_COPY: Record<EditorType, { label: string; description: string }> = {
  word: { label: "Word editor", description: "Write and format a document locally in your browser." },
  spreadsheet: { label: "Spreadsheet editor", description: "Edit cells and export your workbook as CSV." },
  powerpoint: { label: "PowerPoint editor", description: "Build a simple slide deck and export it as a presentation." },
};

function sanitizeImportedHtml(value: string) {
  if (typeof window === "undefined") return "";
  const document = new DOMParser().parseFromString(value, "text/html");
  document.querySelectorAll("script,style,iframe,object,embed,form,link,meta").forEach((node) => node.remove());
  document.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith("on") || /^(javascript|data):/i.test(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return document.body.innerHTML;
}

function DocumentEditorPage() {
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("type");
  const type: EditorType = requestedType === "spreadsheet" || requestedType === "powerpoint" ? requestedType : "word";
  const copy = EDITOR_COPY[type];
  const [documentName, setDocumentName] = useState(`Untitled ${copy.label}`);
  const [saved, setSaved] = useState(false);
  const [openError, setOpenError] = useState("");
  const [wordHtml, setWordHtml] = useState("<h2>Start writing</h2><p>Type your document here. Formatting stays on this device and is never uploaded.</p><p><br></p>");
  const [cells, setCells] = useState<Cell>(() => Array.from({ length: 12 }, (_, row) => Array.from({ length: 8 }, (_, column) => row === 0 ? `Column ${column + 1}` : "")));
  const [slides, setSlides] = useState<Slide[]>([{ title: "Your presentation", body: "Add your talking points here." }]);

  const saveDocument = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  const openFile = async (file: File) => {
    try {
      setOpenError("");
      validateLocalFile(file, "document");
      if (type === "word") {
        const extension = file.name.toLowerCase().split(".").pop();
        if (extension === "docx") {
          const mammoth = await import("mammoth/mammoth.browser");
          const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
          setWordHtml(sanitizeImportedHtml(result.value) || "<p>No editable text was found in this DOCX file.</p>");
        } else if (extension === "rtf" || extension === "txt" || extension === "html" || extension === "htm") {
          const text = await file.text();
          setWordHtml(extension === "html" || extension === "htm" ? sanitizeImportedHtml(text) : `<p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>`);
        } else {
          throw new Error("This editor supports DOCX, RTF, TXT, and HTML files. Legacy binary .doc files are not supported in the browser.");
        }
      } else if (type === "spreadsheet") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const imported = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
        setCells(normalizeCells(imported));
      } else {
        const extension = file.name.toLowerCase().split(".").pop();
        if (extension === "pptx") {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(await file.arrayBuffer());
          const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
          const imported = await Promise.all(slideFiles.map(async (name) => {
            const xml = await zip.files[name].async("text");
            const text = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((match) => decodeXml(match[1])).join(" ");
            return { title: text.slice(0, 80) || "Imported slide", body: text.slice(80) || "Add slide content." };
          }));
          setSlides(imported.length ? imported : [{ title: "Imported presentation", body: "No editable text was found." }]);
        } else if (extension === "txt" || extension === "html" || extension === "htm") {
          const text = await file.text();
          setSlides([{ title: file.name.replace(/\.[^.]+$/, ""), body: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() }]);
        } else {
          throw new Error("PowerPoint editor supports PPTX, TXT, and HTML files.");
        }
      }
      setDocumentName(file.name.replace(/\.[^.]+$/, ""));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : "Unable to open this file.");
    }
  };
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void openFile(file);
  };

  return (
    <main className="office-shell">
      <header className="office-header">
        <a className="office-back" href="/"><ArrowLeft size={17} /> All tools</a>
        <div className="office-brand"><span className="office-brand-mark">m</span><span>meepdf</span></div>
        <input className="office-document-name" value={documentName} onChange={(event) => setDocumentName(event.target.value)} aria-label="Document name" />
        <div className="office-actions">
          {saved && <span className="office-saved">Saved locally</span>}
          <label className="office-button secondary"><FolderOpen size={15} /> Open<input className="office-file-input" type="file" accept={type === "word" ? ".docx,.rtf,.txt,.html,.htm" : type === "spreadsheet" ? ".csv,.tsv,.xls,.xlsx" : ".pptx,.txt,.html,.htm"} onChange={(event) => { const file = event.target.files?.[0]; if (file) void openFile(file); event.currentTarget.value = ""; }} /></label>
          <button className="office-button secondary" onClick={saveDocument}><Save size={15} /> Save</button>
          <ExportButton type={type} documentName={documentName} wordHtml={wordHtml} cells={cells} slides={slides} />
        </div>
      </header>
      <section className="office-intro"><div><div className="office-kicker">{type === "word" ? <FileText size={15} /> : type === "spreadsheet" ? <Grid3X3 size={15} /> : <Presentation size={15} />}{copy.label}</div><h1>{copy.description}</h1></div><span className="office-privacy">Private · runs in your browser</span></section>
      {openError && <p className="office-open-error" role="alert">{openError}</p>}
      {type === "word" && <WordEditor html={wordHtml} setHtml={setWordHtml} onDrop={handleDrop} />}
      {type === "spreadsheet" && <SpreadsheetEditor cells={cells} setCells={setCells} />}
      {type === "powerpoint" && <PowerPointEditor slides={slides} setSlides={setSlides} />}
    </main>
  );
}

export default function DocumentEditorRoute() {
  return <Suspense fallback={<main className="office-shell" />}><DocumentEditorPage /></Suspense>;
}

function WordEditor({ html, setHtml, onDrop }: { html: string; setHtml: (value: string) => void; onDrop: (event: DragEvent<HTMLElement>) => void }) {
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  return <section className="word-workspace">
    <div className="office-toolbar">
      <button className={bold ? "format-button active" : "format-button"} onClick={() => { document.execCommand("bold"); setBold((value) => !value); }}><strong>B</strong></button>
      <button className={italic ? "format-button active" : "format-button"} onClick={() => { document.execCommand("italic"); setItalic((value) => !value); }}><em>I</em></button>
      <button className="format-button" onClick={() => document.execCommand("underline")}><Underline size={16} /></button>
      <select className="font-size" defaultValue="16" onChange={(event) => document.execCommand("fontSize", false, event.target.value)}><option value="3">16 px</option><option value="4">18 px</option><option value="5">24 px</option><option value="6">32 px</option></select>
    </div>
    <article className="word-page" contentEditable suppressContentEditableWarning spellCheck dangerouslySetInnerHTML={{ __html: html }} onInput={(event) => setHtml(event.currentTarget.innerHTML)} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} />
  </section>;
}

function SpreadsheetEditor({ cells, setCells }: { cells: Cell; setCells: Dispatch<SetStateAction<Cell>> }) {
  const columns = Math.max(1, ...cells.map((row) => row.length));
  const updateCell = (row: number, column: number, value: string) => setCells((current) => current.map((line, rowIndex) => rowIndex === row ? line.map((cell, columnIndex) => columnIndex === column ? value : cell) : line));
  return <section className="sheet-workspace"><div className="sheet-toolbar"><span>Sheet 1</span><span className="sheet-hint">Click any cell to edit</span></div><div className="sheet-scroll"><table className="sheet-table"><tbody>{cells.map((line, row) => <tr key={row}><th>{row + 1}</th>{line.map((cell, column) => <td key={column}><input value={cell} onChange={(event) => updateCell(row, column, event.target.value)} aria-label={`Row ${row + 1}, column ${column + 1}`} /></td>)}</tr>)}</tbody></table></div></section>;
}

function PowerPointEditor({ slides, setSlides }: { slides: Slide[]; setSlides: Dispatch<SetStateAction<Slide[]>> }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const slide = slides[activeSlide];
  const updateSlide = (key: keyof Slide, value: string) => setSlides((current) => current.map((item, index) => index === activeSlide ? { ...item, [key]: value } : item));
  const addSlide = () => { setSlides((current) => [...current, { title: "New slide", body: "Add slide content." }]); setActiveSlide(slides.length); };
  const removeSlide = () => { if (slides.length === 1) return; setSlides((current) => current.filter((_, index) => index !== activeSlide)); setActiveSlide(Math.max(0, activeSlide - 1)); };
  return <section className="slides-workspace"><aside className="slide-list">{slides.map((item, index) => <button className={index === activeSlide ? "slide-thumb active" : "slide-thumb"} key={`${item.title}-${index}`} onClick={() => setActiveSlide(index)}><span>{index + 1}</span><strong>{item.title || "Untitled slide"}</strong></button>)}<button className="add-slide" onClick={addSlide}><Plus size={16} /> Add slide</button></aside><div className="slide-editor"><div className="slide-toolbar"><span>Slide {activeSlide + 1} of {slides.length}</span><button className="format-button" onClick={removeSlide} disabled={slides.length === 1}><Trash2 size={16} /> Delete</button></div><article className="presentation-slide"><input className="slide-title" value={slide.title} onChange={(event) => updateSlide("title", event.target.value)} /><textarea className="slide-body" value={slide.body} onChange={(event) => updateSlide("body", event.target.value)} /></article></div></section>;
}

function ExportButton({ type, documentName, wordHtml, cells, slides }: { type: EditorType; documentName: string; wordHtml: string; cells: Cell; slides: Slide[] }) {
  const label = type === "spreadsheet" ? "Export CSV" : type === "powerpoint" ? "Export deck" : "Download document";
  const exportFile = () => {
    const safeName = documentName.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "document";
    const content = type === "spreadsheet" ? cells.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n") : type === "powerpoint" ? `<html><body>${slides.map((slide) => `<section><h1>${escapeHtml(slide.title)}</h1><p>${escapeHtml(slide.body).replaceAll("\n", "<br>")}</p></section>`).join("")}</body></html>` : `<!doctype html><html><head><meta charset="utf-8"></head><body>${wordHtml}</body></html>`;
    const extension = type === "spreadsheet" ? "csv" : "html";
    const blob = new Blob([content], { type: type === "spreadsheet" ? "text/csv" : "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <button className="office-button primary" onClick={exportFile}><Download size={15} /> {label}</button>;
}

function normalizeCells(input: string[][]): Cell {
  const rows = input.length ? input : [[""]];
  const width = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: Math.max(width, 8) }, (_, index) => row[index] ?? ""));
}

function decodeXml(value: string): string {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
