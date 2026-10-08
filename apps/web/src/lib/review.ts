/** Id do título de um grupo: inclui a seção e codifica a chave sem colisões. */
export function groupHeadingId(section: string, key: string): string {
  const hex = [...new TextEncoder().encode(key)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `group-${section}-${hex}`;
}
