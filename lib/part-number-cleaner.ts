const BAD_WORDS = [
  'NEW',
  'USED',
  'OPEN BOX',
  'NO BOX',
  'WITHOUT BOX',
  'W/O BOX',
  'TESTED',
  'TRIED',
  'LOT',
  'PCS',
  'PC',
  'MODULE',
  'PANEL',
  'SYSTEM',
  'CONTROLLER',
  'CONTACTOR',
  'SENSOR',
  'RELAY',
  'SWITCH',
  'POWER',
  'SUPPLY',
];

const BRAND_WORDS = [
  'ABB',
  'SIEMENS',
  'SCHNEIDER',
  'SCHNEIDER ELECTRIC',
  'YOKOGAWA',
  'HONEYWELL',
  'OMRON',
  'PHOENIX',
  'PHOENIX CONTACT',
  'ALLEN',
  'ALLEN BRADLEY',
  'MITSUBISHI',
  'GENERAL ELECTRIC',
  'GE',
  'REXROTH',
  'BOSCH',
  'BENTLY',
  'NEVADA',
   'HDL',
  'Zicon Controls',
  'MESSKO',
  'ZENNIO',
  'ZIEHL',
  'EN-TRONIC',
  'SAUTER',
  'CEAG',
  'EN-TRONIC',
  'TOSHIBA',
  'YORK',
  'IPG',
  'Weidmuller',
  'XYLEM',
  'BBC',
  'PRT',
  'CE',
  'LS',
  'TRAFO',
  'REXA',
  'HID',
  'PILZ',
  'HBM',
  'AOPEN',
  'CABUR',
];

export function extractPartNumberFromTitle(title: string) {
  if (!title) return null;

  let text = title.toUpperCase();

  for (const word of [...BAD_WORDS, ...BRAND_WORDS]) {
    text = text.replaceAll(word, ' ');
  }

  text = text
    .replace(/[(){}\[\],]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const matches = text.match(/\b[A-Z0-9][A-Z0-9\-\/\.]{3,}[A-Z0-9]\b/g);

  if (!matches?.length) return null;

  const filtered = matches.filter((item) => {
    if (/^\d+$/.test(item)) return false;
    if (item.length < 5) return false;
    if (!/[A-Z]/.test(item)) return false;
    if (!/[0-9]/.test(item)) return false;

    // Reject pure electrical ratings only
    if (/^0-10V$/i.test(item)) return false;
    if (/^0-5V$/i.test(item)) return false;
    if (/^1-5V$/i.test(item)) return false;
    if (/^4-20MA$/i.test(item)) return false;
    if (/^\d+VAC$/i.test(item)) return false;
    if (/^\d+VDC$/i.test(item)) return false;
    if (/^\d+AC$/i.test(item)) return false;
    if (/^\d+DC$/i.test(item)) return false;
    if (/^\d+(\.\d+)?A$/i.test(item)) return false;
    if (/^\d+HZ$/i.test(item)) return false;

    return true;
  });

  // Prefer models that contain letters + numbers and are not only voltage/current
  return filtered[0] || null;
}
