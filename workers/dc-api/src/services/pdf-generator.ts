/**
 * PdfGenerator - Generates PDF binary from HTML+CSS via Cloudflare Browser Rendering REST API.
 *
 * Per ADR-004:
 * - POST to Browser Rendering /pdf endpoint with HTML and CSS
 * - US Trade page size: 5.5" x 8.5" (139.7mm x 215.9mm)
 * - Footer with page numbers via headerTemplate/footerTemplate
 * - preferCSSPageSize respects @page rules in the stylesheet
 *
 * The service is decoupled from the export orchestration so the PDF backend
 * can be swapped (e.g., to DocRaptor) without changing the rest of the pipeline.
 */

export interface PdfGeneratorConfig {
  accountId: string;
  apiToken: string;
}

export interface PdfResult {
  /** Raw PDF binary */
  data: ArrayBuffer;
  /** Size in bytes */
  sizeBytes: number;
}

/**
 * Generate a PDF from HTML content using Cloudflare Browser Rendering REST API.
 *
 * @param html - Complete HTML document string
 * @param css - Print stylesheet to inject
 * @param config - Cloudflare account credentials
 * @returns PDF binary as ArrayBuffer
 * @throws Error if the API call fails or returns non-200
 */
export async function generatePdf(
  html: string,
  css: string,
  config: PdfGeneratorConfig,
): Promise<PdfResult> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/browser-rendering/pdf`;

  const body = {
    html,
    addStyleTag: [{ content: css }],
    pdfOptions: {
      width: "5.5in",
      height: "8.5in",
      margin: {
        top: "0.875in",
        right: "0.75in",
        bottom: "1in",
        left: "0.75in",
      },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="width: 100%; text-align: center; font-size: 9pt; font-family: Georgia, serif; color: #888;">
          <span class="pageNumber"></span>
        </div>
      `,
      printBackground: false,
      preferCSSPageSize: true,
    },
    // 60-second timeout (max for Browser Rendering REST API)
    rejectRequestPattern: [],
    waitUntil: "load" as const,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Browser Rendering API failed (${response.status}): ${errorText}`);
  }

  const data = await response.arrayBuffer();

  return {
    data,
    sizeBytes: data.byteLength,
  };
}
