import { PDFDocument, PageSizes } from "pdf-lib";

export const MAX_FILE_SIZE = 100 * 1024 * 1024;

function clearPdfMetadata(document: PDFDocument) {
  document.setTitle("");
  document.setAuthor("");
  document.setSubject("");
  document.setKeywords([]);
  document.setCreator("");
  document.setProducer("");
  document.setCreationDate(new Date(0));
  document.setModificationDate(new Date(0));
}

export function validateLocalFile(file: File, accepted: "pdf" | "image" | "document" = "pdf") {
  if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} is larger than the 100 MB limit.`);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith("image/") || /\.(png|jpe?g)$/i.test(file.name);
  if (accepted === "pdf" && !isPdf) throw new Error(`${file.name} is not a PDF.`);
  if (accepted === "image" && !isImage) throw new Error(`${file.name} is not a supported image.`);
  if (accepted === "document" && !/\.(docx|pptx|rtf|txt|html?|csv|tsv|xls[x]?)$/i.test(file.name)) {
    throw new Error(`${file.name} is not a supported document format.`);
  }
  return file;
}

export async function mergePdfFiles(files: File[], onProgress?: (value: number) => void) {
  const output = await PDFDocument.create();
  clearPdfMetadata(output);
  for (let index = 0; index < files.length; index += 1) {
    const source = await PDFDocument.load(await validateLocalFile(files[index]).arrayBuffer());
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
    onProgress?.(Math.round(((index + 1) / files.length) * 100));
  }
  return output.save();
}

export function parsePageRanges(value: string, pageCount: number) {
  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const [startValue, endValue] = part.trim().split("-").map(Number);
    if (!Number.isInteger(startValue) || startValue < 1 || startValue > pageCount) continue;
    const end = Number.isInteger(endValue) ? Math.min(endValue, pageCount) : startValue;
    for (let page = startValue; page <= end; page += 1) pages.add(page - 1);
  }
  return [...pages].sort((a, b) => a - b);
}

export async function splitPdfFile(file: File, ranges: string, onProgress?: (value: number) => void) {
  const source = await PDFDocument.load(await validateLocalFile(file).arrayBuffer());
  const selected = parsePageRanges(ranges, source.getPageCount());
  if (!selected.length) throw new Error("Enter page ranges such as 1-3, 5, 8-10.");
  const output = await PDFDocument.create();
  clearPdfMetadata(output);
  const pages = await output.copyPages(source, selected);
  pages.forEach((page) => output.addPage(page));
  onProgress?.(100);
  return output.save();
}

export async function imagesToPdf(files: File[], onProgress?: (value: number) => void) {
  const output = await PDFDocument.create();
  clearPdfMetadata(output);
  for (let index = 0; index < files.length; index += 1) {
    const file = validateLocalFile(files[index], "image");
    const bytes = await file.arrayBuffer();
    const image = file.type === "image/png" || /\.png$/i.test(file.name)
      ? await output.embedPng(bytes)
      : await output.embedJpg(bytes);
    const page = output.addPage(PageSizes.A4);
    const margin = 28;
    const scale = Math.min((page.getWidth() - margin * 2) / image.width, (page.getHeight() - margin * 2) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
    onProgress?.(Math.round(((index + 1) / files.length) * 100));
  }
  return output.save();
}

export function downloadPdf(bytes: Uint8Array, name: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
