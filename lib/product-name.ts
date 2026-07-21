type CleanProductNameInput = {
  title: string;
  brand?: string | null;
  partNumber?: string | null;
};

const removablePhrases = [
  'NEW WITHOUT BOX',
  'NEW IN BOX',
  'NEW OPEN BOX',
  'OPEN BOX',
  'BRAND NEW',
  'NEW OLD STOCK',
  'NEW SURPLUS',
  'USED TESTED',
  'TESTED WORKING',
  'FULLY TESTED',
  'REFURBISHED',
  'FOR PARTS',
  'NOT WORKING',
  'FREE SHIPPING',
  'FAST SHIPPING',
  'WORLDWIDE SHIPPING',
  'SAME DAY SHIPPING',
  'READY TO SHIP',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSpaces(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function removePromotionalWords(value: string): string {
  let result = value;

  for (const phrase of removablePhrases) {
    const regex = new RegExp(
      `\\b${escapeRegExp(phrase)}\\b`,
      'gi'
    );

    result = result.replace(regex, ' ');
  }

  return result;
}

function removeQuantityWords(value: string): string {
  return value.replace(
    /\b(LOT OF\s+\d+|LOT\s+\d+|\d+\s*PCS?|QTY\s*[:\-]?\s*\d+)\b/gi,
    ' '
  );
}

export function cleanProductName({
  title,
}: CleanProductNameInput): string {
  const originalTitle = String(title || '').trim();

  if (!originalTitle) {
    return '';
  }

  let result = originalTitle;

  result = removePromotionalWords(result);
  result = removeQuantityWords(result);
  result = normalizeSpaces(result);

  /*
   * لا نضيف البراند أو رقم القطعة بالقوة.
   * لا نحذف الشرطات.
   * لا نغيّر الأحرف الكبيرة والصغيرة.
   * إذا أصبح الاسم فارغًا نرجع عنوان eBay الأصلي.
   */
  if (!result) {
    return originalTitle.slice(0, 180);
  }

  return result.slice(0, 180).trim();
}
