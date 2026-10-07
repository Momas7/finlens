import { describe, expect, it } from 'vitest';
import { groupHeadingId } from './review';

describe('groupHeadingId', () => {
  it('a mesma chave em seções diferentes gera ids diferentes', () => {
    expect(groupHeadingId('needs-you', 'm:ifood|out')).not.toBe(
      groupHeadingId('likely', 'm:ifood|out'),
    );
  });
  it('chaves que só diferem em pontuação não colidem', () => {
    expect(groupHeadingId('likely', 'd:A B|out')).not.toBe(groupHeadingId('likely', 'd:A-B|out'));
  });
  it('é um id HTML válido', () => {
    expect(groupHeadingId('likely', 'd:PADARIA SÃO|out')).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});
