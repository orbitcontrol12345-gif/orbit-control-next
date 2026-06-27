export function extractPartNumber(title: string): string {
  if (!title) return '';

  let text = String(title)
    .toUpperCase()
    .replace(/[()[\]{}_,;:*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const brands = [
    'SCHNEIDER ELECTRIC',
    'ALLEN BRADLEY',
    'PHOENIX CONTACT',
    'GENERAL ELECTRIC',
    'BOSCH REXROTH',
    'BENTLY NEVADA',
    'SIEMENS',
    'SCHNEIDER',
    'HONEYWELL',
    'YOKOGAWA',
    'OMRON',
    'ABB',
    'GE',
    'ASCO',
    'YORK',
    'CEAG',
    'MERTEN',
    'SOCOMEC',
    'KEITHLEY',
    'TRAFAG',
    'BERGHOF',
    'ECKELMANN',
    'HONEYWELL',
    'PHOENIX',
    'HIRSCHMANN',
    'SICK',
    'YOKOGAWA',
    'FLUKE',
  ];

  for (const brand of brands) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(brand)}\\b`, 'g'), ' ');
  }

  text = text.replace(/\s+/g, ' ').trim();

  const badUnit =
    /\b\d+(?:\.\d+)?\s?(VAC|VDC|VAC\/DC|AC|DC|V|HZ|KHZ|MHZ|VA|KVA|W|KW|A|MA|AMP|AMPS|BAR|PSI|MM|CM|M|KG|G|RPM|HP|PH)\b/i;

  const hardReject = [
    'INPUT',
    'OUTPUT',
    'MODULE',
    'CONTROLLER',
    'SENSOR',
    'RELAY',
    'SWITCH',
    'POWER',
    'SUPPLY',
    'BOARD',
    'CARD',
    'PANEL',
    'METER',
    'DRIVE',
    'CABLE',
    'TESTER',
    'CAMERA',
    'PROBE',
    'MISSING',
    'WITHOUT',
    'WITH',
    'BOX',
    'NEW',
    'USED',
    'OLD',
    'FILTHY',
    'DAMAGED',
    'BROKEN',
    'TRIED',
    'TESTED',
  ];

  const patterns = [
    /\b[A-Z]{2,6}\s+[A-Z]{2,6}\s+\d{2,6}\b/g,      // STB PDT 3100
    /\b[A-Z]{2,12}\s+\d{2,8}[A-Z]?\b/g,            // PAT 5001 / COUNTIS E12 / TORKEL 860
    /\b[A-Z]{1,8}\d{2,}[A-Z0-9\-\/.]*\b/g,         // SXWSATXXXSLX / CJ1W-OD211
    /\b\d{3,12}\s+[A-Z]\b/g,                       // 6200029 E
    /\b\d{3,12}\b/g,                               // 2611 / 550590
    /\b[A-Z0-9][A-Z0-9\-\/.]{4,35}[A-Z0-9]\b/g,   // 6ES... / 140DDI...
  ];

  const candidates: string[] = [];

  for (const pattern of patterns) {
    const found = text.match(pattern) || [];
    candidates.push(...found);
  }

  const scored = candidates
    .map((raw) => {
      const value = raw.replace(/^[.\-/\s]+|[.\-/\s]+$/g, '').replace(/\s+/g, ' ').trim();

      if (!value) return null;
      if (value.length < 3 || value.length > 35) return null;
      if (badUnit.test(value)) return null;
      if (hardReject.includes(value)) return null;

      const words = value.split(/\s+/);
      if (words.some((w) => hardReject.includes(w))) return null;

      const hasDigit = /\d/.test(value);
      const hasLetter = /[A-Z]/.test(value);

      if (!hasDigit) return null;

      let score = 0;

      if (hasLetter) score += 10;
      score += (value.match(/\d/g) || []).length * 2;
      score += (value.match(/[A-Z]/g) || []).length;
      score += (value.match(/[-/.]/g) || []).length * 5;

      if (/^[A-Z]{1,8}\d/.test(value)) score += 12;
      if (/^[A-Z]{2,6}\s+[A-Z]{2,6}\s+\d{2,6}$/.test(value)) score += 18;
      if (/^[A-Z]{2,12}\s+\d{2,8}[A-Z]?$/.test(value)) score += 14;
      if (/^\d{3,12}$/.test(value)) score += 3;
      if (value.length >= 5 && value.length <= 22) score += 5;

      if (/^\d{2,3}$/.test(value)) score -= 10;
      if (/^\d+\s?(M|MM|CM|KG|A|V|W|HZ|PH)$/.test(value)) score -= 30;
      if (/\b(230VAC|24VDC|250VA|50HZ|30M|2X3A|220V|400VAC|DC12V)\b/i.test(value)) score -= 40;

      return { value, score };
    })
    .filter(Boolean) as { value: string; score: number }[];

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.value || '';
}

export const extractPartNumberFromTitle = extractPartNumber;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
