/** "" / "   " → null agar kolom opsional di database bersih. */
export function nullable(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
