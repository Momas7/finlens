/** Texto de um arquivo: UTF-8 (com ou sem BOM) e, se for inválido, Windows-1252 (OFX antigo). */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}
