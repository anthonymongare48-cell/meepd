"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Canvas as FabricCanvas, FabricObject, IText, Image as FabricImage } from "fabric";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

type PdfDocument = Awaited<
  ReturnType<(typeof import("pdfjs-dist"))["getDocument"]>["promise"]
>;
type TextLayerInstance = {
  render: () => Promise<void>;
  cancel?: () => void;
};
type AnnotationMode = "browse" | "draw" | "text" | "signature" | "rectangle" | "highlight" | "comment" | "image";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

function parseColor(value: unknown) {
  const source = typeof value === "string" ? value : "#172033";
  const hex = source.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      r: Number.parseInt(hex[1].slice(0, 2), 16) / 255,
      g: Number.parseInt(hex[1].slice(2, 4), 16) / 255,
      b: Number.parseInt(hex[1].slice(4, 6), 16) / 255,
    };
  }
  const rgbMatch = source.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1].split(",").map((part) => Number.parseFloat(part.trim()));
    return { r: r / 255, g: g / 255, b: b / 255 };
  }
  return { r: 0.09, g: 0.13, b: 0.2 };
}

export default function PdfViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const annotationsRef = useRef<Map<number, object[]>>(new Map());
  const displaySizesRef = useRef<Map<number, { width: number; height: number }>>(new Map());
  const pdfRef = useRef<PdfDocument | null>(null);
  const pdfDocRef = useRef<PDFDocument | null>(null);
  const loadingTaskRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const textRenderTaskRef = useRef<TextLayerInstance | null>(null);
  const renderIdRef = useRef(0);
  const saveAnnotationsRef = useRef<() => void>(() => undefined);
  const fileDataRef = useRef<Uint8Array | null>(null);
  const loadIdRef = useRef(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mode, setMode] = useState<AnnotationMode>("browse");
  const [strokeColor, setStrokeColor] = useState("#2563eb");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(18);
  const [fontColor, setFontColor] = useState("#172033");
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [rearrangeMode, setRearrangeMode] = useState(false);
  const [dragOverPage, setDragOverPage] = useState<number | null>(null);
  const draggedPageRef = useRef<number | null>(null);
  const dragOverPageRef = useRef<number | null>(null);
  const [commentText, setCommentText] = useState("Comment");
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signRequestedRef = useRef(false);

  const saveAnnotations = useCallback(() => {
    const fabric = fabricRef.current;
    if (fabric && pageCount) annotationsRef.current.set(pageNumber, fabric.toJSON().objects);
  }, [pageCount, pageNumber]);

  useEffect(() => {
    saveAnnotationsRef.current = saveAnnotations;
  }, [saveAnnotations]);

  useEffect(() => {
    signRequestedRef.current = new URLSearchParams(window.location.search).get("sign") === "1";
    setRearrangeMode(new URLSearchParams(window.location.search).get("rearrange") === "1");
  }, []);

  useEffect(() => {
    if (pageCount && signRequestedRef.current) {
      setMode("signature");
      setSignatureOpen(true);
      signRequestedRef.current = false;
    }
  }, [pageCount]);

  const setupFabric = useCallback(async (width: number, height: number) => {
    const element = annotationCanvasRef.current;
    if (!element) return;
    const { Canvas } = await import("fabric");
    fabricRef.current?.dispose();
    const fabric = new Canvas(element, {
      selection: true,
      interactive: true,
      enableRetinaScaling: true,
    });
    fabric.setDimensions({ width, height });
    fabric.setZoom(1);
    const objects = annotationsRef.current.get(pageNumber) ?? [];
    if (objects.length) await fabric.loadFromJSON({ objects });
    fabricRef.current = fabric;
    fabric.isDrawingMode = mode === "draw";
    if (fabric.freeDrawingBrush) {
      fabric.freeDrawingBrush.color = strokeColor;
      fabric.freeDrawingBrush.width = strokeWidth;
    }
    fabric.skipTargetFind = mode === "browse";
    fabric.selection = mode !== "browse";
    element.style.pointerEvents = mode === "browse" ? "none" : "auto";
    fabric.renderAll();
  }, [mode, pageNumber, strokeColor, strokeWidth]);

  const renderPage = useCallback(async (nextPage: number, nextScale: number) => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;

    const renderId = ++renderIdRef.current;
    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    textRenderTaskRef.current?.cancel?.();
    textRenderTaskRef.current = null;

    const page = await pdf.getPage(nextPage);
    if (renderId !== renderIdRef.current) {
      page.cleanup();
      return;
    }
    const viewport = page.getViewport({ scale: nextScale });
    const dpr = window.devicePixelRatio || 1;
    const context = canvas.getContext("2d");
    const textLayer = textLayerRef.current;
    if (!context || !textLayer) return;

    saveAnnotations();
    fabricRef.current?.dispose();
    fabricRef.current = null;
    canvas.width = Math.ceil(viewport.width * dpr);
    canvas.height = Math.ceil(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);
    textLayer.replaceChildren();
    textLayer.style.width = `${viewport.width}px`;
    textLayer.style.height = `${viewport.height}px`;
    displaySizesRef.current.set(nextPage, { width: viewport.width, height: viewport.height });

    const task = page.render({ canvasContext: context, canvas, viewport });
    renderTaskRef.current = task;
    const textContent = await page.getTextContent();
    if (renderId !== renderIdRef.current) {
      page.cleanup();
      return;
    }
    const pdfjsLib = await import("pdfjs-dist");
    const textTask: TextLayerInstance = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container: textLayer,
      viewport,
    });
    textRenderTaskRef.current = textTask;
    try {
      await Promise.all([task.promise, textTask.render()]);
      if (renderId === renderIdRef.current) {
        await setupFabric(viewport.width, viewport.height);
      }
    } catch (renderError) {
      if ((renderError as { name?: string }).name !== "RenderingCancelledException") {
        throw renderError;
      }
    } finally {
      if (renderTaskRef.current === task) renderTaskRef.current = null;
      if (textRenderTaskRef.current === textTask) textRenderTaskRef.current = null;
      page.cleanup();
    }
  }, [saveAnnotations, setupFabric]);

  const loadPdf = useCallback(async (arrayBuffer: ArrayBuffer, name: string) => {
    const loadId = ++loadIdRef.current;
    setIsLoading(true);
    setError("");
    ++renderIdRef.current;
    renderTaskRef.current?.cancel();
    await loadingTaskRef.current?.destroy();
    loadingTaskRef.current = null;
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/workers/pdf.worker.min.mjs";
      const data = new Uint8Array(arrayBuffer);
      const editablePdf = await PDFDocument.load(data);
      const loadingTask = pdfjsLib.getDocument({ data });
      loadingTaskRef.current = loadingTask;
      const pdf = await loadingTask.promise;
      if (loadId !== loadIdRef.current) {
        await loadingTask.destroy();
        return;
      }
      loadingTaskRef.current = null;
      pdfRef.current?.cleanup();
      pdfRef.current = pdf;
      pdfDocRef.current = editablePdf;
      fileDataRef.current = data;
      setFileName(name);
      setPageNumber(1);
      setScale(1);
      const previews: string[] = [];
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const previewPage = await pdf.getPage(index);
        const previewViewport = previewPage.getViewport({ scale: 0.18 });
        const previewCanvas = document.createElement("canvas");
        previewCanvas.width = Math.ceil(previewViewport.width);
        previewCanvas.height = Math.ceil(previewViewport.height);
        const previewContext = previewCanvas.getContext("2d");
        if (previewContext) {
          await previewPage.render({ canvasContext: previewContext, canvas: previewCanvas, viewport: previewViewport }).promise;
          previews.push(previewCanvas.toDataURL("image/jpeg", 0.72));
        }
        previewPage.cleanup();
      }
      setThumbnails(previews);
      setPageCount(pdf.numPages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to open this PDF.");
      fileDataRef.current = null;
      pdfRef.current = null;
      setPageCount(0);
      setThumbnails([]);
    } finally {
      if (loadId === loadIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pdfRef.current || !pageCount) return;
    renderPage(pageNumber, scale).catch((renderError) => {
      setError(renderError instanceof Error ? renderError.message : "Unable to render this page.");
    });
  }, [pageCount, pageNumber, renderPage, scale]);

  useEffect(() => {
    return () => {
      ++loadIdRef.current;
      ++renderIdRef.current;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      textRenderTaskRef.current?.cancel?.();
      textRenderTaskRef.current = null;
      textLayerRef.current?.replaceChildren();
      saveAnnotationsRef.current();
      fabricRef.current?.dispose();
      fabricRef.current = null;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (context && canvas) {
        context.resetTransform();
        context.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      }
      void loadingTaskRef.current?.destroy();
      pdfRef.current?.cleanup();
      pdfRef.current = null;
      pdfDocRef.current = null;
    };
  }, []);

  const openFile = (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    void file.arrayBuffer().then((arrayBuffer) => loadPdf(arrayBuffer, file.name));
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) openFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) openFile(file);
  };

  const fitToWidth = useCallback(async () => {
    const pdf = pdfRef.current;
    const container = viewportRef.current;
    if (!pdf || !container) return;
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(container.clientWidth - 48, 1);
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, availableWidth / baseViewport.width)));
    page.cleanup();
  }, [pageNumber]);

  const changePage = (delta: number) => {
    setPageNumber((current) => Math.min(pageCount, Math.max(1, current + delta)));
  };

  const refreshPdfBytes = async (nextPdf: PDFDocument) => {
    const bytes = await nextPdf.save();
    pdfDocRef.current = nextPdf;
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    await loadPdf(buffer, fileName);
  };

  const rotatePage = async (index: number) => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc) return;
    const pdfPage = pdfDoc.getPage(index);
    pdfPage.setRotation(degrees((pdfPage.getRotation().angle + 90) % 360));
    await refreshPdfBytes(pdfDoc);
    setPageNumber(index + 1);
  };

  const deletePage = async (index: number) => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc || pdfDoc.getPageCount() <= 1) return;
    saveAnnotations();
    pdfDoc.removePage(index);
    const nextAnnotations = new Map<number, object[]>();
    annotationsRef.current.forEach((objects, page) => {
      if (page === index + 1) return;
      nextAnnotations.set(page > index + 1 ? page - 1 : page, objects);
    });
    annotationsRef.current = nextAnnotations;
    await refreshPdfBytes(pdfDoc);
    setPageNumber((current) => Math.min(current, pdfDoc.getPageCount()));
  };

  const movePage = async (index: number, direction: -1 | 1) => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc) return;
    const target = index + direction;
    if (target < 0 || target >= pdfDoc.getPageCount()) return;
    saveAnnotations();
    const copied = await pdfDoc.copyPages(pdfDoc, [index]);
    const [pageToMove] = copied;
    pdfDoc.removePage(index);
    pdfDoc.insertPage(target, pageToMove);
    const nextAnnotations = new Map(annotationsRef.current);
    const moved = nextAnnotations.get(index + 1);
    const swapped = nextAnnotations.get(target + 1);
    if (moved) nextAnnotations.set(target + 1, moved); else nextAnnotations.delete(target + 1);
    if (swapped) nextAnnotations.set(index + 1, swapped); else nextAnnotations.delete(index + 1);
    annotationsRef.current = nextAnnotations;
    await refreshPdfBytes(pdfDoc);
    setPageNumber(target + 1);
  };

  const movePageTo = async (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= pageCount || to >= pageCount) return;
    const direction: -1 | 1 = to < from ? -1 : 1;
    for (let index = from; index !== to; index += direction) {
      await movePage(index, direction);
    }
  };

  const startPageDrag = (index: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!rearrangeMode || (event.target as HTMLElement).closest(".thumbnail-actions")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draggedPageRef.current = index;
    dragOverPageRef.current = index;
    setDragOverPage(index);
  };

  const updatePageDragTarget = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!rearrangeMode || draggedPageRef.current === null) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-page-index]");
    if (!target) return;
    const nextTarget = Number(target.dataset.pageIndex);
    if (!Number.isInteger(nextTarget)) return;
    dragOverPageRef.current = nextTarget;
    setDragOverPage(nextTarget);
  };

  const finishPageDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const source = draggedPageRef.current;
    if (!rearrangeMode || source === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const target = dragOverPageRef.current;
    draggedPageRef.current = null;
    dragOverPageRef.current = null;
    setDragOverPage(null);
    if (target !== null) void movePageTo(source, target);
  };

  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    fabric.isDrawingMode = mode === "draw";
    fabric.skipTargetFind = mode === "browse";
    fabric.selection = mode !== "browse";
    if (fabric.freeDrawingBrush) {
      fabric.freeDrawingBrush.color = strokeColor;
      fabric.freeDrawingBrush.width = strokeWidth;
    }
    if (annotationCanvasRef.current) {
      annotationCanvasRef.current.style.pointerEvents = mode === "browse" ? "none" : "auto";
    }
    fabric.renderAll();
  }, [mode, strokeColor, strokeWidth]);

  const addText = async () => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const { IText } = await import("fabric");
    const text = new IText("Type here", {
      left: 48, top: 48, fontSize, fill: fontColor, editable: true,
    });
    fabric.add(text);
    fabric.setActiveObject(text);
    text.enterEditing();
    fabric.renderAll();
  };

  const addShape = async (kind: "rectangle" | "highlight") => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const { Rect } = await import("fabric");
    const shape = new Rect({
      left: 72,
      top: 72,
      width: 220,
      height: 90,
      fill: kind === "highlight" ? "#facc15" : "transparent",
      opacity: kind === "highlight" ? 0.35 : 1,
      stroke: strokeColor,
      strokeWidth,
    });
    fabric.add(shape);
    fabric.setActiveObject(shape);
    fabric.renderAll();
  };

  const addComment = async () => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const { IText } = await import("fabric");
    const comment = new IText(commentText || "Comment", {
      left: 72,
      top: 72,
      fontSize: 14,
      fill: "#5b4300",
      backgroundColor: "#fff1a8",
      padding: 10,
      width: 180,
    });
    fabric.add(comment);
    fabric.setActiveObject(comment);
    comment.enterEditing();
    fabric.renderAll();
  };

  const handleImageFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void addSignature(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const addSignature = async (dataUrl: string) => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const { FabricImage } = await import("fabric");
    const image = await FabricImage.fromURL(dataUrl);
    image.set({ left: 48, top: 48, scaleX: 0.5, scaleY: 0.5 });
    fabric.add(image as FabricObject);
    fabric.setActiveObject(image as FabricObject);
    fabric.renderAll();
    setSignatureOpen(false);
  };

  const handleSignatureFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void addSignature(String(reader.result));
    reader.readAsDataURL(file);
  };

  const drawSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.strokeStyle = "#172033";
    context.lineWidth = 3;
    context.lineCap = "round";
    let drawing = false;
    const start = (event: PointerEvent) => { drawing = true; context.beginPath(); context.moveTo(event.offsetX, event.offsetY); };
    const move = (event: PointerEvent) => { if (drawing) { context.lineTo(event.offsetX, event.offsetY); context.stroke(); } };
    const stop = () => { drawing = false; };
    canvas.onpointerdown = start;
    canvas.onpointermove = move;
    canvas.onpointerup = stop;
    canvas.onpointerleave = stop;
  };

  const useDrawnSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) void addSignature(canvas.toDataURL("image/png"));
  };

  const exportPdf = async () => {
    if (!pdfRef.current || !pdfDocRef.current) return;
    saveAnnotationsRef.current();
    const pdfDoc = pdfDocRef.current;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const { StaticCanvas } = await import("fabric");

    for (let index = 0; index < pdfDoc.getPageCount(); index += 1) {
      const pdfPage = pdfDoc.getPage(index);
      const sourcePage = await pdfRef.current.getPage(index + 1);
      const nativeViewport = sourcePage.getViewport({ scale: 1 });
      const displaySize = displaySizesRef.current.get(index + 1);
      const objects = annotationsRef.current.get(index + 1) ?? [];
      if (!displaySize || !objects.length) {
        sourcePage.cleanup();
        continue;
      }

      const scaleFactor = nativeViewport.width / displaySize.width;
      const textObjects = objects.filter((object) => {
        const value = object as { type?: string };
        return value.type === "i-text" || value.type === "textbox" || value.type === "text";
      }) as Array<{ left?: number; top?: number; width?: number; height?: number; scaleX?: number; scaleY?: number; fontSize?: number; text?: string; fill?: string }>;

      for (const object of textObjects) {
        const width = (object.width ?? 0) * (object.scaleX ?? 1);
        const height = (object.height ?? (object.fontSize ?? 12)) * (object.scaleY ?? 1);
        const x = (object.left ?? 0) * scaleFactor;
        const y = nativeViewport.height - ((object.top ?? 0) * scaleFactor) - (height * scaleFactor);
        const color = parseColor(object.fill);
        pdfPage.drawText(object.text ?? "", {
          x,
          y,
          font,
          size: (object.fontSize ?? 12) * scaleFactor,
          color: rgb(color.r, color.g, color.b),
        });
      }

      const rasterObjects = objects.filter((object) => !textObjects.includes(object));
      if (rasterObjects.length) {
        const tempElement = document.createElement("canvas");
        const rasterCanvas = new StaticCanvas(tempElement, {
          width: displaySize.width,
          height: displaySize.height,
        });
        await rasterCanvas.loadFromJSON({ objects: rasterObjects });
        const pngUrl = rasterCanvas.toDataURL({ format: "png", multiplier: scaleFactor });
        const image = await pdfDoc.embedPng(pngUrl);
        pdfPage.drawImage(image, {
          x: 0,
          y: 0,
          width: nativeViewport.width,
          height: nativeViewport.height,
        });
        rasterCanvas.dispose();
      }
      sourcePage.cleanup();
    }

    const bytes = await pdfDoc.save();
    const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `edited-${fileName || "document.pdf"}`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  };

  useEffect(() => {
    if (signatureOpen) drawSignature();
  }, [signatureOpen]);

  return (
    <main className="viewer-shell">
      <header className="site-header">
        <div className="site-brand"><span className="site-brand-mark">M</span><strong>meepdf</strong></div>
        <nav className="site-nav" aria-label="Product navigation">
          <button>MERGE PDF</button>
          <button>SPLIT PDF</button>
          <button>COMPRESS PDF</button>
          <button>CONVERT PDF <span>⌄</span></button>
          <button>ALL PDF TOOLS <span>⌄</span></button>
        </nav>
        <div className="site-actions"><button className="apps-button" aria-label="All tools" onClick={() => setToolsOpen(true)}>⠿</button></div>
      </header>
      <header className="viewer-toolbar">
        <strong className="viewer-title">Edit PDF</strong>
        <span className="viewer-file-name">{fileName || "No document loaded"}</span>
        <div className="viewer-controls">
          <button className="viewer-button" onClick={() => fileInputRef.current?.click()}>Open PDF</button>
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" hidden onChange={handleInput} />
          <button className="viewer-button" onClick={() => setToolsOpen((open) => !open)}>All tools</button>
          <button className="viewer-button" onClick={() => setDrawerOpen((open) => !open)}>
            {drawerOpen ? "Hide pages" : "Show pages"}
          </button>
          <select className="viewer-select" value={mode} onChange={(event) => {
            const nextMode = event.target.value as AnnotationMode;
            setMode(nextMode);
            if (nextMode === "text") void addText();
            if (nextMode === "signature") setSignatureOpen(true);
            if (nextMode === "rectangle" || nextMode === "highlight") void addShape(nextMode);
            if (nextMode === "comment") void addComment();
          }}>
            <option value="browse">Browse</option>
            <option value="draw">Draw</option>
            <option value="text">Add Text</option>
            <option value="signature">Add Signature</option>
            <option value="rectangle">Rectangle</option>
            <option value="highlight">Highlight</option>
            <option value="comment">Comment</option>
            <option value="image">Insert Image</option>
          </select>
          {mode === "draw" && <>
            <input aria-label="Stroke color" type="color" value={strokeColor} onChange={(event) => setStrokeColor(event.target.value)} />
            <input aria-label="Stroke width" className="stroke-width" type="range" min="1" max="20" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} />
          </>}
          {mode === "text" && <>
            <input aria-label="Font color" type="color" value={fontColor} onChange={(event) => setFontColor(event.target.value)} />
            <input aria-label="Font size" className="font-size" type="number" min="8" max="72" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
            <button className="viewer-button" onClick={() => void addText()}>Add text</button>
          </>}
          {(mode === "rectangle" || mode === "highlight") && <>
            <input aria-label="Shape color" type="color" value={strokeColor} onChange={(event) => setStrokeColor(event.target.value)} />
            <input aria-label="Shape stroke width" className="stroke-width" type="range" min="1" max="20" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} />
            <button className="viewer-button" onClick={() => void addShape(mode)}>Add shape</button>
          </>}
          {mode === "comment" && <>
            <input aria-label="Comment text" className="comment-input" value={commentText} onChange={(event) => setCommentText(event.target.value)} />
            <button className="viewer-button" onClick={() => void addComment()}>Add comment</button>
          </>}
          {mode === "image" && <label className="viewer-button">Insert image<input type="file" accept="image/*" hidden onChange={handleImageFile} /></label>}
          <span className="page-counter">{pageCount ? `${pageNumber} / ${pageCount}` : "— / —"}</span>
          <button className="viewer-button" disabled={!pageCount || pageNumber === 1} onClick={() => changePage(-1)}>
            Prev
          </button>
          <button className="viewer-button" disabled={!pageCount || pageNumber === pageCount} onClick={() => changePage(1)}>
            Next
          </button>
          <button className="viewer-button" disabled={!pageCount || scale <= MIN_SCALE} onClick={() => setScale((value) => Math.max(MIN_SCALE, value - SCALE_STEP))}>
            −
          </button>
          <span className="zoom-label">{Math.round(scale * 100)}%</span>
          <button className="viewer-button" disabled={!pageCount || scale >= MAX_SCALE} onClick={() => setScale((value) => Math.min(MAX_SCALE, value + SCALE_STEP))}>
            +
          </button>
          <button className="viewer-button" disabled={!pageCount} onClick={() => void fitToWidth()}>
            Fit to width
          </button>
          <button className="viewer-button viewer-export" disabled={!pageCount || !fileDataRef.current} onClick={() => void exportPdf()}>
            Export PDF
          </button>
        </div>
      </header>
      {toolsOpen && <div className="viewer-tool-drawer"><div className="viewer-tool-drawer-header"><strong>PDF tools</strong><button onClick={() => setToolsOpen(false)} aria-label="Close tools">×</button></div><div className="viewer-tool-grid">{["Merge PDF", "Split PDF", "Rearrange PDF", "Compress PDF", "JPG to PDF", "Edit PDF", "Sign PDF", "OCR PDF", "Compare PDF"].map((tool) => <a key={tool} href={tool === "Edit PDF" ? "/editor" : tool === "Sign PDF" ? "/editor?sign=1" : tool === "Rearrange PDF" ? "/editor?rearrange=1" : "/"}>{tool}</a>)}</div></div>}

      {!pageCount ? (
        <label
          className={`pdf-dropzone ${isDragging ? "is-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input type="file" accept=".pdf,application/pdf" hidden onChange={handleInput} />
          <span className="dropzone-icon">↥</span>
          <strong>{isLoading ? "Loading PDF…" : "Drop a PDF here"}</strong>
          <span>or click to choose a .pdf file</span>
        </label>
      ) : (
        <div className="viewer-body">
          {drawerOpen && <aside className="page-drawer" aria-label="PDF pages">
            <div className="drawer-header"><strong>Pages</strong><span>{pageCount}</span></div>
            <div className={`thumbnail-list ${rearrangeMode ? "rearrange-list" : ""}`}>
              {thumbnails.map((thumbnail, index) => (
                <div className={`thumbnail-card ${pageNumber === index + 1 ? "active" : ""} ${dragOverPage === index ? "drag-over" : ""}`} key={`${thumbnail}-${index}`} draggable={false} data-page-index={index} onPointerDown={(event) => startPageDrag(index, event)} onPointerMove={updatePageDragTarget} onPointerUp={finishPageDrag} onPointerCancel={finishPageDrag}>
                  <button className="thumbnail-button" onClick={() => setPageNumber(index + 1)}>
                    <img src={thumbnail} alt={`Page ${index + 1}`} />
                    <span>{index + 1}</span>
                  </button>
                  <div className="thumbnail-actions">
                    <button title="Rotate page" onClick={() => void rotatePage(index)}>↻</button>
                    <button title="Move up" disabled={index === 0} onClick={() => void movePage(index, -1)}>↑</button>
                    <button title="Move down" disabled={index === pageCount - 1} onClick={() => void movePage(index, 1)}>↓</button>
                    <button title="Delete page" disabled={pageCount <= 1} onClick={() => void deletePage(index)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </aside>}
          <div ref={viewportRef} className="pdf-viewport">
            {rearrangeMode && <div className="rearrange-hint">Drag page thumbnails to rearrange them, then export the reordered PDF.</div>}
            {isLoading && !pageCount && <div className="viewer-loading">Loading…</div>}
            <div className="pdf-page">
              <canvas ref={canvasRef} className="pdf-canvas" />
              <div ref={textLayerRef} className="textLayer" aria-label="PDF text layer" />
              <canvas ref={annotationCanvasRef} className="annotation-canvas" aria-label="PDF annotations" />
            </div>
          </div>
        </div>
      )}
      {error && <p className="viewer-error" role="alert">{error}</p>}
      {signatureOpen && (
        <div className="signature-backdrop" role="dialog" aria-modal="true" aria-label="Add signature">
          <div className="signature-dialog">
            <h2>Add signature</h2>
            <p>Draw below or upload an image.</p>
            <canvas ref={signatureCanvasRef} className="signature-pad" width={480} height={150} />
            <div className="signature-actions">
              <label className="viewer-button">Upload image<input type="file" accept="image/*" hidden onChange={handleSignatureFile} /></label>
              <button className="viewer-button" onClick={useDrawnSignature}>Use drawing</button>
              <button className="viewer-button" onClick={() => setSignatureOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
