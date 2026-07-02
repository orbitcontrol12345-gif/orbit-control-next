const BAD = new Set([
  'NEW', 'USED', 'OPEN', 'BOX', 'LOT', 'PCS', 'PIECE', 'PIECES',
  'BOARD', 'CARD', 'MODULE', 'UNIT', 'POWER', 'SUPPLY', 'INTERFACE',
  'RELAY', 'RELAYS', 'CIRCUIT', 'PRINTED', 'REV', 'VERSION',
  'VERTIV', 'SIEMENS', 'EMERSON', 'ABB', 'MORS', 'SMITT', 'METROBILITY',
]);

function cleanTitle(input: string) {
  return String(input || '')
    .toUpperCase()
    .replace(/[()[\]{},;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePart(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9\-/.]/g, '')
    .trim();
}

function isBadPart(value: string) {
  const v = normalizePart(value);

  if (!v) return true;
  if (v.length < 4 || v.length > 35) return true;
  if (BAD.has(v)) return true;
  if (/^\d{10,14}$/.test(v)) return true;
  if (/^\d+(VAC|VDC|AC|DC|V|HZ|KW|W|A|MA|BAR|PSI|MM|CM|KG)$/i.test(v)) return true;
  if (/^REV\.?[A-Z0-9]*$/i.test(v)) return true;

  return false;
}

function scorePart(value: string) {
  const v = normalizePart(value);
  if (isBadPart(v)) return -999;

  let s = 0;

  if (/^\d{3}-\d{5}-\d{2}[A-Z]?$/.test(v)) s += 150; // 710-02821-08P
  if (/^[A-Z]{2,}-\d{2,}[A-Z0-9-]*$/.test(v)) s += 140; // FDA-125
  if (/^[A-Z]\d{3}-\d{2}$/.test(v)) s += 130; // R643-15
  if (/^\d{2}[A-Z]\d{5}[A-Z]\d{1,4}$/.test(v)) s += 120; // 15B10903G1
  if (/^\d{2}[A-Z]\d{5}$/.test(v)) s += 60; // 15H50581

  if (/[A-Z]/.test(v)) s += 10;
  if (/\d/.test(v)) s += 10;
  if (/[-/.]/.test(v)) s += 20;
  if (v.length >= 5 && v.length <= 24) s += 10;

  if (/^\d{2}H\d{5}$/.test(v)) s -= 40;
  if (/^\d{2}C\d{5}$/.test(v)) s -= 30;

  return s;
}

export function extractIndustrialPartNumberV2(input: string): string {
  const text = cleanTitle(input);
  if (!text) return '';

  const patterns = [
    /\b\d{3}-\d{5}-\d{2}[A-Z]?\b/g,
    /\b[A-Z]{2,}-\d{2,}[A-Z0-9-]*\b/g,
    /\b[A-Z]\d{3}-\d{2}\b/g,
    /\b\d{2}[A-Z]\d{5}[A-Z]\d{1,4}\b/g,
    /\b\d{2}[A-Z]\d{5}\b/g,
    /\b[A-Z]{1,8}\d{2,}[A-Z0-9\-/.]*\b/g,
    /\b\d{5,14}[A-Z]?\b/g,
  ];

  const candidates: string[] = [];

  for (const pattern of patterns) {
    candidates.push(...(text.match(pattern) || []));
  }

  const ranked = candidates
    .map(normalizePart)
    .filter((x) => !isBadPart(x))
    .map((value) => ({ value, score: scorePart(value) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.value || '';
}
