export function preferBrandPart({
  brand,
  current,
  extracted,
  title,
}: {
  brand?: string;
  current?: string;
  extracted?: string;
  title?: string;
}) {
  const b = String(brand || '').toUpperCase();
  const c = String(current || '').toUpperCase().trim();
  const e = String(extracted || '').toUpperCase().trim();
  const t = String(title || '').toUpperCase();

  if (!e) return c;

  // Honeywell: غالبًا الرقم الطويل أهم من short code مثل TFB811
  if (b.includes('HONEYWELL')) {
    if (/^\d{8,14}$/.test(c)) return c;
    if (/\d{8,14}/.test(t)) {
      const match = t.match(/\b\d{8,14}\b/);
      if (match?.[0]) return match[0];
    }
  }
// Philips: فضّل أرقام التصنيع الطويلة مثل 8900 136 33001 بدل SM40
if (b.includes('PHILIPS') || t.includes('PHILIPS')) {
  const spaced = t.match(/\b\d{4}\s+\d{3}\s+\d{5}\b/);
  if (spaced?.[0]) return spaced[0].replace(/\s+/g, '');

  const longNumber = t.match(/\b\d{10,14}\b/);
  if (longNumber?.[0]) return longNumber[0];

  const lbb = t.match(/\bLBB\s*\d{3,5}\/\d{1,4}\b/);
  if (lbb?.[0]) return lbb[0].replace(/\s+/g, '');
}
  // Allen-Bradley: فضّل Catalog Numbers
  if (b.includes('ALLEN') || t.includes('ALLEN-BRADLEY')) {
    const match = t.match(/\b(1756|1762|1771|1784|1794|1734|1747|6186|825|100)-?[A-Z0-9]+(?:\/[A-Z])?\b/);
    if (match?.[0]) return match[0];
  }

  // Siemens
  if (b.includes('SIEMENS')) {
    const match = t.match(/\b(6ES|6AV|7ME|7ML|3RT|3RV|5SY|5SL)[A-Z0-9-]+\b/);
    if (match?.[0]) return match[0];
  }

  // Pilz
  if (b.includes('PILZ') || t.includes('PILZ')) {
    const pnoz = t.match(/\bPNOZ\s?[A-Z0-9]+\b/);
    const numeric = t.match(/\b7\d{5}\b/);
    if (pnoz?.[0]) return pnoz[0].replace(/\s+/g, '');
    if (numeric?.[0]) return numeric[0];
  }

  // Mors Smitt
  if (b.includes('MORS') || t.includes('SMITT')) {
    const match = t.match(/\b[A-Z]{2,}-\d{2,}[A-Z0-9-]*\b/);
    if (match?.[0]) return match[0];
  }

  return e;
}
