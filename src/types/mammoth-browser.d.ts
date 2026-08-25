/**
 * mammoth ships a prebuilt browser bundle without type definitions. Only the
 * one function this app calls is declared.
 */
declare module "mammoth/mammoth.browser.js" {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{
    value: string;
    messages: Array<{ type: string; message: string }>;
  }>;
}
