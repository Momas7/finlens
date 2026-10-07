import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`bloco ${selector} não encontrado`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const light = block(':root');
const dark = { ...light, ...block(':root[data-theme="dark"]') };

describe.each([
  ['claro', light],
  ['escuro', dark],
])('tokens (%s)', (_name, t) => {
  it('bordas de controles têm contraste não-texto de 3:1', () => {
    expect(contrast(t.line as string, t.page as string)).toBeGreaterThanOrEqual(3);
    expect(contrast(t.line as string, t.raised as string)).toBeGreaterThanOrEqual(3);
  });
  it('traços sobre a fita têm contraste de 3:1', () => {
    expect(contrast(t['tape-tick'] as string, t.tape as string)).toBeGreaterThanOrEqual(3);
  });
  it('texto de apoio legível', () => {
    expect(contrast(t['ink-soft'] as string, t.page as string)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t['ink-soft'] as string, t.raised as string)).toBeGreaterThanOrEqual(4.5);
  });
});
