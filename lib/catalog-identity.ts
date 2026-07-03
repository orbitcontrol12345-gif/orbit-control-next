function clean(value: any) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function normalizeCompact(value: any) {
  return clean(value).replace(/[^A-Z0-9]/g, '');
}

const BAD_PARTS = new Set([
  '',
  'UNKNOWN',
  'PN',
  'P/N',
  'P N',
  'I/O',
  'IO',
  'W/O',
  'WO',
  'N/A',
  'NA',
  'NONE',
  'NULL',
  'MODULE',
  'BOARD',
  'RELAY',
  'POWER',
  'SUPPLY',
  'SYSTEM',
  'INPUT',
  'OUTPUT',
  'SWITCH',
  'SENSOR',
  'CARD',
  'UNIT',
]);

export function getConditionGroup(condition: any, name?: any) {
  const text = `${clean(condition)} ${clean(name)}`;

  if (
    text.includes('FOR PARTS') ||
    text.includes('NOT WORKING') ||
    text.includes('PARTS ONLY')
  ) {
    return 'FOR_PARTS';
  }

  if (text.includes('REFURBISHED') || text.includes('SELLER REFURBISHED')) {
    return 'REFURBISHED';
  }

  if (
    text.includes('OPEN BOX') ||
    text.includes('NEW OTHER') ||
    text.includes('NEW WITHOUT BOX') ||
    text.includes('NEW W/O BOX') ||
    text.includes('NO BOX')
  ) {
    return 'NEW_OTHER';
  }

  if (text.includes('NEW')) {
    return 'NEW';
  }

  if (text.includes('USED') || text.includes('PRE-OWNED')) {
    return 'USED';
  }

  return 'UNKNOWN';
}

export function isBadPartNumber(value: any) {
  const raw = clean(value);
  const compact = normalizeCompact(value);

  if (BAD_PARTS.has(raw) || BAD_PARTS.has(compact)) return true;

  if (/^27\d{10}$/.test(compact)) return true;
  if (/^\d{12,13}$/.test(compact)) return true;

  if (compact.length < 3) return true;

  return false;
}

export function normalizeCatalogPart(value: any) {
  return normalizeCompact(value);
}

export function makeCatalogIdentity(input: {
  partNumber?: any;
  name?: any;
  condition?: any;
}) {
  const conditionGroup = getConditionGroup(input.condition, input.name);

  if (!isBadPartNumber(input.partNumber)) {
    return {
      conditionGroup,
      catalogKey: `PN-${normalizeCatalogPart(input.partNumber)}::${conditionGroup}`,
    };
  }

  const nameKey = normalizeCompact(input.name);

  return {
    conditionGroup,
    catalogKey: `NAME-${nameKey}::${conditionGroup}`,
  };
}
