import { extractIndustrialPartNumberV2 } from './industrial-part-number-v2';

const BAD_PARTS = new Set([
  'UNKNOWN',
  'VERTIV',
  'SIEMENS',
  'EMERSON',
  'ABB',
  'MORS',
  'SMITT',
  'ALLEN-BRADLEY',
  'GREYSTONE',
  'JANITZA',
  'LEUZE',
  'WOODWARD',
  'DRAGER',
  'EUROTHERM',
]);

function clean(v: string) {
  return String(v || '').trim().toUpperCase();
}

function isBadCurrentPart(current: string, brand?: string) {
  const c = clean(current);
  const b = clean(brand || '');

  if (!c) return true;
  if (BAD_PARTS.has(c)) return true;
  if (b && c === b) return true;
  if (/^\d{10,14}$/.test(c)) return true; // eBay item id
  return false;
}

function isBetterPart(current: string, next: string) {
  const c = clean(current);
  const n = clean(next);
// إذا الرقم الحالي يبدو Part Number صناعي صحيح، لا نغيره
if (
  c &&
  /[A-Z]/.test(c) &&
  /\d/.test(c) &&
  c.length >= 5 &&
  !/^\d{10,14}$/.test(c) &&
  !c.includes('REV') &&
  ![
    'UNKNOWN',
    'VERTIV',
    'SIEMENS',
    'EMERSON',
    'ABB',
    'ALLEN-BRADLEY',
    'MORS',
    'SMITT',
    'MODULE',
    'BOARD',
    'POWER',
    'RELAY',
    'SWITCH',
    'STARTER'
  ].includes(c)
) {
  return false;
}
  if (!n) return false;
  if (!c) return true;
// إذا الرقم الحالي يبدو موديل صناعي كامل، لا نستبدله بجزء أقصر
if (
  c &&
  n &&
  c.length > n.length &&
  /[A-Z]/.test(c) &&
  /\d/.test(c) &&
  !/^\d{10,14}$/.test(c) &&
  !c.includes('REV') &&
  !['UNKNOWN','VERTIV','SIEMENS','EMERSON','ABB','ALLEN-BRADLEY'].includes(c)
) {
  return false;
}
  // R643 -> R643-15
  if (n.startsWith(c) && n.length > c.length && n.includes('-')) return true;

  // FDA -> FDA-125
  if (n.startsWith(c) && n.length > c.length && /\d/.test(n)) return true;

  // 15B10903G1 REV.2 / 15H50581 -> 15B10903G1
  // إذا كان الرقم الحالي أطول ويحتوي الرقم الجديد، لا تستبدله
// إلا إذا كانت حالة REV المعروفة
if (
  c.includes(n) &&
  c.length > n.length &&
  (c.includes('-') || c.includes('/') || c.includes('.')) &&
  !c.includes('REV')
) {
  return false;
}
  if (c.includes(n) && n.length >= 6 && /\d/.test(n)) return true;

  return false;
}

export function getSafePartNumber({
  title,
  currentPartNumber,
  brand,
}: {
  title: string;
  currentPartNumber?: string;
  brand?: string;
}) {
  const extracted = extractIndustrialPartNumberV2(title);
  const current = currentPartNumber || '';

  if (!extracted) return current;

  if (isBadCurrentPart(current, brand)) return extracted;

  if (isBetterPart(current, extracted)) return extracted;

  return current;
}
