export function isValidGstinFormat(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

// GSTIN checksum (MOD 36)
export function isValidGstinChecksum(gstin: string): boolean {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const gstinChars = gstin.split("");

  let sum = 0;
  let factor = 2;

  for (let i = gstinChars.length - 2; i >= 0; i--) {
    const code = chars.indexOf(gstinChars[i]);
    let product = code * factor;
    factor = factor === 2 ? 1 : 2;

    sum += Math.floor(product / 36) + (product % 36);
  }

  const checkCode = (36 - (sum % 36)) % 36;
  return chars[checkCode] === gstinChars[gstinChars.length - 1];
}

export function getStateCodeFromGstin(gstin: string): number {
  return parseInt(gstin.substring(0, 2), 10);
}
