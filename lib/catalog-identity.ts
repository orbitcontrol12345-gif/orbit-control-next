function clean(value: any) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export function getConditionGroup(condition: any, name?: any) {
  const text = `${clean(condition)} ${clean(name)}`;

  if (
    text.includes('FOR PARTS') ||
    text.includes('NOT WORKING') ||
    text.includes('PARTS ONLY')
  ) {
    return 'FOR_PARTS';
  }

  if (
    text.includes('REFURBISHED') ||
    text.includes('SELLER REFURBISHED')
  ) {
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
  const v = clean(value);

  return (
    !v ||
    v === 'UNKNOWN' ||
    /^27\d{10}$/.test(v) ||
    /^\d{12,13}$/.test(v)
  );
}

export function normalizeCatalogPart(value: any) {
  return clean(value)
    .replace(/[^A-Z0-9]/g, '');
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
      catalogKey: `${normalizeCatalogPart(input.partNumber)}::${conditionGroup}`,
    };
  }

  const nameKey = clean(input.name).replace(/[^A-Z0-9]/g, '');

  return {
    conditionGroup,
    catalogKey: `NAME-${nameKey}::${conditionGroup}`,
  };
}
