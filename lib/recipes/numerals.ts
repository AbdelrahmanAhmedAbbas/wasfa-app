export function toArabicIndicDigits(value: string): string {
  return value.replace(/\d/g, (digit) => String.fromCharCode(0x0660 + Number(digit)));
}
