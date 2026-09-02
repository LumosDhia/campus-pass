function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** GS1 mod-10 check digit for a 13-digit GTIN-14 base. */
function gtinCheckDigit(base13: string): number {
  const digits = base13.split("").reverse().map(Number);
  let sum = 0;
  digits.forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10;
}

/** A random, checksum-valid 14-digit GTIN — used as a new program's code. */
export function generateProgramCode(): string {
  const base = randomDigits(13);
  return base + gtinCheckDigit(base);
}

export function generateStudentId(): string {
  return `S-${randomDigits(4)}-${randomDigits(4)}`;
}

/** A syntactically-valid but unbacked (no known private key) address — fine for
 * an SBT owner since nothing in this system requires the holder to sign anything. */
export function generateWalletAddress(): string {
  const hex = "0123456789abcdef";
  let addr = "0x";
  for (let i = 0; i < 40; i++) addr += hex[Math.floor(Math.random() * hex.length)];
  return addr;
}
