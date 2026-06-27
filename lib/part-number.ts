export function extractPartNumber(title: string): string {
  const upper = String(title || '')
    .toUpperCase()
    .replace(/[()[\]{}_,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!upper) return '';

  const ignoreWords = new Set([
    'NEW','USED','OPEN','BOX','NO','WITH','WITHOUT','ORIGINAL','PACKAGING',
    'OLD','DAMAGED','BROKEN','PART','PARTS','ONLY','TRIED','TESTED',
    'MODULE','UNIT','PANEL','DRIVE','INVERTER','CONTROLLER','CONTROL',
    'BOARD','CARD','POWER','SUPPLY','INPUT','OUTPUT','ANALOG','DIGITAL',
    'RELAY','CONTACTOR','SENSOR','SWITCH','VALVE','MOTOR','CABLE'
  ]);

  const badUnitPattern =
    /^(?:\d+(?:\.\d+)?)(?:VAC|VDC|VAC\/DC|V|HZ|KHZ|MHZ|VA|KVA|W|KW|A|AMP|AMPS|BAR|PSI|MM|CM|M|KG|G|NM|RPM|PH|HP)$/i;

  const badLooseUnitPattern =
    /\b\d+(?:\.\d+)?\s*(VAC|VDC|VAC\/DC|HZ|KHZ|MHZ|VA|KVA|W|KW|AMP|AMPS|BAR|PSI|MM|CM|KG|RPM|HP)\b/i;

  const candidates =
    upper.match(/\b[A-Z0-9][A-Z0-9\-\/.]{3,40}[A-Z0-9]\b/g) || [];

  const scored = candidates
    .map((raw) => {
      const value = raw.replace(/^[.\-/]+|[.\-/]+$/g, '');

      if (value.length < 5 || value.length > 35) return null;
      if (ignoreWords.has(value)) return null;
      if (!/[A-Z]/.test(value) || !/\d/.test(value)) return null;
      if (/^\d+$/.test(value)) return null;
      if (badUnitPattern.test(value)) return null;
      if (badLooseUnitPattern.test(value)) return null;

      const letters = (value.match(/[A-Z]/g) || []).length;
      const digits = (value.match(/\d/g) || []).length;
      const separators = (value.match(/[-/.]/g) || []).length;

      let score = 0;

      score += digits * 2;
      score += letters;
      score += separators * 3;

      if (/^[A-Z]{1,6}\d/.test(value)) score += 8;
      if (/\d[A-Z]{1,4}$/.test(value)) score += 4;
      if (separators > 0) score += 5;
      if (value.length >= 7 && value.length <= 22) score += 5;

      if (/^(?:24|48|110|120|220|230|240|380|400|415|480|500|600)V/.test(value)) score -= 20;
      if (/^\d+(A|V|W|HZ|MM|CM|KG|BAR|PSI|RPM|HP)$/.test(value)) score -= 20;

      return { value, score };
    })
    .filter(Boolean) as { value: string; score: number }[];

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.value || '';
}
