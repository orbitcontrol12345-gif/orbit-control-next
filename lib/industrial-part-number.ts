const BAD_UNITS =
  /\b\d+(?:\.\d+)?\s?(VAC|VDC|VAC\/DC|AC|DC|V|VOLTS?|HZ|KHZ|MHZ|VA|KVA|W|KW|A|MA|AMP|AMPS|BAR|PSI|MM|CM|M|KG|G|RPM|HP|PH|L)\b/i;

const BRAND_WORDS = new Set([
  'ABB','SIEMENS','SCHNEIDER','HONEYWELL','PHOENIX','YOKOGAWA','OMRON',
  'MITSUBISHI','EATON','REXROTH','BOSCH','GE','PILZ','SICK','FLUKE',
  'CROWCON','ELCOMETER','DUCATI','ADALET','ROHDE','SCHWARZ','MATSUSHITA',
  'REYROLLE','NEWCO','MORS','SMITT','ACTIVE','DIAMOND','NEOTRONICS',
]);

const BAD_WORDS = new Set([
  'NEW','USED','OPEN','BOX','WITHOUT','WITH','FILTHY','DAMAGED','BROKEN',
  'TESTED','TRIED','ONLY','CASE','COVER','BATTERY','SCREEN','KEYPAD',
  'MODULE','CONTROLLER','BOARD','RELAY','METER','POWER','SUPPLY','DETECTOR',
  'APPLIANCE','SYSTEM','PANEL','SWITCH','CARD','UNIT','INPUT','OUTPUT',
  'CIRCUIT','PCB','PRINTED','ELECTRIC','ELECTRONICS','AUTOMATION','INDUSTRIAL',
  'SERIES','TYPE','MODEL','REV','ISSUE','VER','VERSION',
]);

function clean(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/[()[\]{},;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value: string) {
  return value
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9\-/.+*]/g, '')
    .trim();
}

function isBad(value: string) {
  const v = value.toUpperCase();
  if (!v) return true;
  if (v.length < 2 || v.length > 40) return true;
  if (BAD_UNITS.test(v)) return true;
  if (BRAND_WORDS.has(v)) return true;
  if (BAD_WORDS.has(v)) return true;
  if (/^\d{1,2}$/.test(v)) return true;
  if (/^(NEW|USED|TESTED|MODULE|BOARD|RELAY|METER|CONTROLLER)$/i.test(v)) return true;
  return false;
}

function score(value: string) {
  if (isBad(value)) return -999;

  let s = 0;

  if (/[A-Z]/.test(value)) s += 10;
  if (/\d/.test(value)) s += 10;
  if (/[-/.]/.test(value)) s += 8;
  if (/[*+]/.test(value)) s += 6;
  if (/^[A-Z]{1,8}\d/.test(value)) s += 14;
  if (/^\d{3,14}[A-Z]?$/.test(value)) s += 7;
  if (/^\d{2,4}[A-Z]{2,6}\d{2,8}/.test(value)) s += 18;
  if (value.length >= 4 && value.length <= 24) s += 6;

  if (/^(100|110|120|220|230|240|250|380|400|415|480|500|600)$/.test(value)) s -= 50;

  return s;
}

export function extractIndustrialPartNumber(input: string): string {
  const original = clean(input);
  if (!original) return '';

  const joined = original
    .replace(/\b(140)\s+(CPU|DDI|DAI|DRA|CRA|CPS|ACI|ACO|CHS)\s+(\d{2,4})\s+(\d{2,4})\b/g, '$1$2$3$4')
    .replace(/\b(H46C)\s+(\d{3,5})\b/g, '$1$2')
    .replace(/\b(DSE)\s+(\d{3,5})\b/g, '$1$2')
    .replace(/\b(TRG)\s?(\d{1,4})\b/g, '$1$2')
    .replace(/\b(TAC)\s+(XENTA)\s+(\d{3,5}[A-Z]?)\b/g, '$1$2$3')
    .replace(/\b(FL)\s+(SWITCH)\s+(SFN)\s+(\d+TX)\b/g, '$3$4')
    .replace(/\b(COUNTIS)\s+(E\d+)\b/g, '$1$2')
    .replace(/\b(OXYGUARD)\s+(OM\d+)\b/g, '$2')
    .replace(/\b(PNOZ)\s+(S\d{1,4})\s+(\d{4,8})?\b/g, (_m, a, b, c) => `${a}${b}${c || ''}`)
    .replace(/\b(ST|FC|AD|MAC)(\d+)\s?\*?\s?([A-Z])\b/g, '$1$2*$3');

  const searchText = `${joined} ${original}`;

  const patterns = [
    /\b140(?:CPU|DDI|DAI|DRA|CRA|CPS|ACI|ACO|CHS)\d{4,8}\b/g,
    /\b7SD\d{4}-\d[A-Z]{2}\d{2}-\d[A-Z]{2}\d(?:\/[A-Z]{2})?\b/g,
    /\b[A-Z]{1,8}\d{1,12}[A-Z]?\b/g,
    /\b\d{6,14}[A-Z]?\b/g,
    /\b[A-Z0-9]+[-/][A-Z0-9][A-Z0-9-/]{2,35}\b/g,
    /\b[A-Z]{1,8}\d?\*?[A-Z]\b/g,
  ];

  const candidates: string[] = [];

  for (const pattern of patterns) {
    candidates.push(...(searchText.match(pattern) || []));
  }

  const ranked = candidates
    .map(normalize)
    .filter((x) => !isBad(x))
    .map((value) => ({ value, score: score(value) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.value || '';
}

export const extractPartNumber = extractIndustrialPartNumber;
export const extractPartNumberFromTitle = extractIndustrialPartNumber;
