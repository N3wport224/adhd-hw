/**
 * mammoth ships a prebuilt browser bundle without type definitions. Only the
 * functions this app calls are declared.
 */
declare module "mammoth/mammoth.browser.js" {
  interface Message {
    type: string;
    message: string;
  }
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{
    value: string;
    messages: Message[];
  }>;
  /** Returns semantic HTML: h1–h6, p, ul/ol/li, blockquote, table. */
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: { styleMap?: string[] },
  ): Promise<{ value: string; messages: Message[] }>;
}
