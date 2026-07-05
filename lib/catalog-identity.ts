function clean(value: any) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function compact(value: any) {
  return clean(value).replace(/[^A-Z0-9]/g, '');
}

function normalizeBrand(value: any) {
  return compact(value || 'UNKNOWN') || 'UNKNOWN';
}

function normalizePart(value: any) {
  return compact(value || 'UNKNOWN') || 'UNKNOWN';
}

export function getConditionGroup(condition: any, name?: any) {
  const text = `${clean(condition)} ${clean(name)}`;

  if (
    text.includes('FOR PARTS') ||
    text.includes('PARTS ONLY') ||
    text.includes('NOT WORKING') ||
    text.includes('NON WORKING') ||
    text.includes('FAULTY') ||
    text.includes('BROKEN')
  ) {
    return 'FOR_PARTS';
  }

  if (
    text.includes('REFURBISHED') ||
    text.includes('SELLER REFURBISHED') ||
    text.includes('RECONDITIONED')
  ) {
    return 'REFURBISHED';
  }

  if (
    text.includes('OPEN BOX') ||
    text.includes('NEW OPEN BOX')
  ) {
    return 'NEW_OPEN_BOX';
  }

  if (
    text.includes('NEW OTHER') ||
    text.includes('SEE DETAILS') ||
    text.includes('NEW WITHOUT BOX') ||
    text.includes('NEW W/O BOX') ||
    text.includes('NO BOX') ||
    text.includes('OLD BOX') ||
    text.includes('DAMAGED BOX')
  ) {
    return 'NEW_OTHER';
  }

  if (text.includes('NEW')) {
    return 'NEW';
  }

  if (
    text.includes('USED') ||
    text.includes('PRE-OWNED') ||
    text.includes('PREOWNED')
  ) {
    return 'USED';
  }

  return 'UNKNOWN';
}

export function makeCatalogIdentity(input: {
  brand?: any;
  partNumber?: any;
  name?: any;
  condition?: any;
}) {
  const brandKey = normalizeBrand(input.brand);
  const partKey = normalizePart(input.partNumber);
  const conditionGroup = getConditionGroup(input.condition, input.name);

  if (partKey && partKey !== 'UNKNOWN') {
    return {
      conditionGroup,
      catalogKey: `PN-${brandKey}-${partKey}::${conditionGroup}`,
    };
  }

  const nameKey = compact(input.name || 'UNKNOWN') || 'UNKNOWN';

  return {
    conditionGroup,
    catalogKey: `NAME-${brandKey}-${nameKey}::${conditionGroup}`,
  };
}
