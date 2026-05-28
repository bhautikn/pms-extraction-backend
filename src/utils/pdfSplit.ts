import { PDFDocument } from 'pdf-lib';

/**
 * Get the total number of pages in a PDF buffer.
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  return pdfDoc.getPageCount();
}

/**
 * Split a PDF buffer into two parts at the given page index.
 * Part 1 = pages 0..(splitAtPage - 1)  (i.e. first `splitAtPage` pages)
 * Part 2 = pages splitAtPage..(end)
 */
export async function splitPdf(
  pdfBuffer: Buffer,
  splitAtPage: number,
): Promise<{ part1: Buffer; part2: Buffer }> {
  const sourcePdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = sourcePdf.getPageCount();

  if (splitAtPage <= 0 || splitAtPage >= totalPages) {
    throw new Error(`Invalid split point: ${splitAtPage}. PDF has ${totalPages} pages.`);
  }

  // Build Part 1
  const part1Doc = await PDFDocument.create();
  const part1Indices = Array.from({ length: splitAtPage }, (_, i) => i);
  const copiedPages1 = await part1Doc.copyPages(sourcePdf, part1Indices);
  copiedPages1.forEach((page) => part1Doc.addPage(page));

  // Build Part 2
  const part2Doc = await PDFDocument.create();
  const part2Indices = Array.from({ length: totalPages - splitAtPage }, (_, i) => i + splitAtPage);
  const copiedPages2 = await part2Doc.copyPages(sourcePdf, part2Indices);
  copiedPages2.forEach((page) => part2Doc.addPage(page));

  const part1Bytes = await part1Doc.save();
  const part2Bytes = await part2Doc.save();

  return {
    part1: Buffer.from(part1Bytes),
    part2: Buffer.from(part2Bytes),
  };
}

/**
 * Extract a small range of pages from a PDF for the split-point analysis.
 * Returns a slim PDF containing only the requested page range.
 * startPage and endPage are 1-indexed (matching the document's printed page numbers).
 */
export async function extractPageRange(
  pdfBuffer: Buffer,
  startPage: number,
  endPage: number,
): Promise<Buffer> {
  const sourcePdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = sourcePdf.getPageCount();

  // Clamp to valid range (convert to 0-indexed)
  const start = Math.max(0, startPage - 1);
  const end = Math.min(totalPages - 1, endPage - 1);

  const newDoc = await PDFDocument.create();
  const indices = Array.from({ length: end - start + 1 }, (_, i) => i + start);
  const copiedPages = await newDoc.copyPages(sourcePdf, indices);
  copiedPages.forEach((page) => newDoc.addPage(page));

  const bytes = await newDoc.save();
  return Buffer.from(bytes);
}
