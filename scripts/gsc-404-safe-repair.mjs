import fs from 'node:fs';
import path from 'node:path';

import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const SITE_URL = 'https://www.orbit-surplus.com';
const PAGE_SIZE = 1000;
const APPLY = process.argv.includes('--apply');

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const inputFile = getArg('--input');
const reportFile = getArg('--report');

if (!inputFile) {
  throw new Error('Usage: node scripts/gsc-404-safe-repair.mjs --input Table.csv [--report report.json] [--apply]');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase environment variables are not configured.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TITLE_NOISE = new Set([
  'A', 'AN', 'AND', 'BOX', 'FOR', 'FROM', 'IN', 'ITEM', 'LOT', 'NEW',
  'NO', 'OF', 'ON', 'ONLY', 'OPEN', 'OR', 'PARTS', 'PCS', 'REFURBISHED',
  'SELLER', 'SET', 'TESTED', 'THE', 'TO', 'TRIED', 'UNIT', 'USED',
  'WITH', 'WITHOUT', 'WO', 'WORKING', 'OK', 'ORBIT', 'CONTROL',
  'AUTOMATION',
]);

const GENERIC_IDENTIFIERS = new Set([
  '120VAC', '220VAC', '230VAC', '240VAC', '24VDC', '12VDC', '50HZ',
  '60HZ', '5060HZ', 'NEWOPENBOX', 'OPENBOX', 'TESTEDOK', 'DINRAIL',
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value || row.length > 0) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }

  const headers = rows.shift()?.map((item) => item.trim()) || [];
  return rows
    .filter((items) => items.some(Boolean))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function decodeValue(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

function normalizeText(value) {
  return decodeValue(value)
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toUpperCase();
}

function compact(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function tokens(value) {
  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length > 1 && !TITLE_NOISE.has(token)),
  );
}

function similarity(left, right) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

function pathKey(value) {
  let pathname = String(value || '');
  try {
    pathname = new URL(pathname, SITE_URL).pathname;
  } catch {
    // Keep the original path.
  }
  pathname = decodeValue(pathname).replace(/\/{2,}/g, '/');
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.length > 1 && !pathname.endsWith('/')) pathname += '/';
  return pathname.toLowerCase();
}

function legacyTitleFromUrl(url) {
  try {
    const pathname = decodeValue(new URL(url).pathname);
    return pathname.replace(/^\/product\//i, '').replace(/\/+$/, '').replace(/[-_]+/g, ' ');
  } catch {
    return '';
  }
}

function productSlugFromDestination(value) {
  try {
    const pathname = decodeValue(new URL(value, SITE_URL).pathname);
    const match = pathname.match(/^\/products\/([^/]+)\/?$/i);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function ebayIdFromValue(value) {
  const match = String(value || '').match(/(?:^|[^0-9])(\d{12})(?:[^0-9]|$)/);
  return match ? match[1] : '';
}

function isUsefulIdentifier(value) {
  const normalized = compact(value);
  return (
    normalized.length >= 6 &&
    normalized.length <= 40 &&
    /\d/.test(normalized) &&
    !/^\d{12}$/.test(normalized) &&
    !/^R\d{4,}$/i.test(normalized) &&
    !/^REV\d+$/i.test(normalized) &&
    !/(?:VDC|VAC|AMAX|HZ|WATT|AMP)/i.test(normalized) &&
    !GENERIC_IDENTIFIERS.has(normalized)
  );
}

function identifierSegments(value) {
  const source = String(value || '').trim();
  if (!source) return [];

  return Array.from(
    new Set(
      [source, ...source.split(/\s+(?:\/|\||OR)\s+|\s*;\s*/i)]
        .map((item) => compact(item))
        .filter(isUsefulIdentifier),
    ),
  );
}

function hasConflictingNearCode(oldTitle, productTitle, matchedIdentifier) {
  const productValue = compact(productTitle);
  const matched = compact(matchedIdentifier);
  const oldCodes = normalizeText(oldTitle)
    .split(/\s+/)
    .map(compact)
    .filter((item) => item.length >= 5 && /[A-Z]/.test(item) && /\d/.test(item));

  for (const oldCode of oldCodes) {
    if (oldCode === matched || productValue.includes(oldCode)) continue;

    for (let index = 0; index <= productValue.length - oldCode.length; index += 1) {
      const candidate = productValue.slice(index, index + oldCode.length);
      let differences = 0;
      for (let offset = 0; offset < oldCode.length; offset += 1) {
        if (oldCode[offset] !== candidate[offset]) differences += 1;
      }
      if (differences === 1 && /[A-Z]/.test(candidate) && /\d/.test(candidate)) {
        return true;
      }
    }
  }

  return false;
}

function tokenAfterIdentifier(title, identifier) {
  const titleTokens = normalizeText(title).split(/\s+/).filter(Boolean);
  const target = compact(identifier);

  for (let start = 0; start < titleTokens.length; start += 1) {
    let joined = '';
    for (let end = start; end < titleTokens.length; end += 1) {
      joined += compact(titleTokens[end]);
      if (joined === target) return titleTokens[end + 1] || '';
      if (!target.startsWith(joined)) break;
    }
  }

  return '';
}

function hasConflictingVariant(oldTitle, productTitle, identifier) {
  const oldNext = tokenAfterIdentifier(oldTitle, identifier);
  const productNext = tokenAfterIdentifier(productTitle, identifier);
  const isVariant = (value) => value && value.length <= 4 && (/\d/.test(value) || /^[A-Z]{1,3}$/.test(value));

  return isVariant(oldNext) && isVariant(productNext) && oldNext !== productNext;
}

function uniqueById(items) {
  return Array.from(new Map(items.map((item) => [String(item.id), item])).values());
}

async function fetchAll(table, columns, filter) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function indexUnique(map, key, product) {
  if (!key) return;
  const existing = map.get(key) || [];
  if (!existing.some((item) => String(item.id) === String(product.id))) {
    existing.push(product);
    map.set(key, existing);
  }
}

function brandMatches(title, brand) {
  const brandValue = compact(brand);
  return brandValue.length >= 3 && compact(title).includes(brandValue);
}

function findSafeProduct(title, products, exactTitleIndex, redirectRow) {
  const rowEbayId = String(redirectRow?.ebay_item_id || '').trim();
  if (rowEbayId) {
    const matches = uniqueById(products.filter((product) => String(product.ebay_item_id || '') === rowEbayId));
    if (matches.length === 1) return { product: matches[0], reason: 'EXACT_REDIRECT_EBAY_ID', score: 100 };
  }

  const exactTitleMatches = uniqueById(exactTitleIndex.get(normalizeText(title)) || []);
  if (exactTitleMatches.length === 1) {
    return { product: exactTitleMatches[0], reason: 'EXACT_NORMALIZED_TITLE', score: 99 };
  }

  const oldCompact = compact(title);
  const candidates = [];

  for (const product of products) {
    if (!brandMatches(title, product.brand)) continue;

    const partIdentifiers = identifierSegments(product.part_number);
    const modelIdentifiers = identifierSegments(product.model_number);
    const identifiers = [
      ...partIdentifiers.map((identifier) => ({ identifier, field: 'part_number' })),
      ...modelIdentifiers.map((identifier) => ({ identifier, field: 'model_number' })),
    ];

    const matchedIdentifiers = identifiers.filter(({ identifier }) => oldCompact.includes(identifier));
    if (!matchedIdentifiers.length) continue;

    const titleSimilarity = similarity(title, product.name || product.slug || '');
    matchedIdentifiers.sort((left, right) => {
      if (left.field !== right.field) return left.field === 'part_number' ? -1 : 1;
      return right.identifier.length - left.identifier.length;
    });
    const bestIdentifier = matchedIdentifiers[0];
    const longestIdentifier = bestIdentifier.identifier.length;
    const minimumSimilarity = bestIdentifier.field === 'part_number' ? 0.72 : 0.78;
    if (titleSimilarity < minimumSimilarity) continue;
    if (hasConflictingNearCode(title, product.name || product.slug || '', bestIdentifier.identifier)) continue;
    if (hasConflictingVariant(title, product.name || product.slug || '', bestIdentifier.identifier)) continue;

    candidates.push({
      product,
      identifier: bestIdentifier.identifier,
      field: bestIdentifier.field,
      titleSimilarity,
      score: 80 + Math.round(titleSimilarity * 15) + Math.min(5, longestIdentifier - 5),
    });
  }

  const uniqueCandidates = uniqueById(candidates.map((item) => item.product)).map((product) =>
    candidates.find((item) => String(item.product.id) === String(product.id)),
  );
  uniqueCandidates.sort((left, right) => right.score - left.score);

  if (uniqueCandidates.length !== 1) return null;

  const only = uniqueCandidates[0];
  return {
    product: only.product,
    reason: `EXACT_${only.field.toUpperCase()}:${only.identifier}`,
    score: only.score,
  };
}

function repairRow(oldUrl, oldPath, product, reason, score, redirectRow) {
  const canonicalPath = `/products/${encodeURIComponent(String(product.slug).trim())}`;
  return {
    old_url: redirectRow?.old_url || oldUrl,
    old_path: redirectRow?.old_path || oldPath,
    new_url: `${SITE_URL}${canonicalPath}`,
    match_level: reason,
    match_score: score,
    score_gap: null,
    product_id: product.id,
    ebay_item_id: product.ebay_item_id || null,
    brand: product.brand || null,
    part_number: product.part_number || product.model_number || null,
    product_name: product.name || null,
    match_reasons: [reason, 'GSC_404_SAFE_REPAIR'],
    is_active: true,
    redirect_enabled: true,
    updated_at: new Date().toISOString(),
  };
}

async function writeInChunks(rows) {
  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100);
    const { error } = await supabase.from('migration_redirects').upsert(chunk, { onConflict: 'old_url' });
    if (error) throw error;
  }
}

const csvRows = parseCsv(fs.readFileSync(path.resolve(inputFile), 'utf8'));
const legacyUrls = Array.from(new Set(csvRows.map((row) => row.URL).filter((url) => {
  try {
    return new URL(url).pathname.toLowerCase().startsWith('/product/');
  } catch {
    return false;
  }
})));

const [products, redirects] = await Promise.all([
  fetchAll(
    'products',
    'id,ebay_item_id,sku,slug,name,brand,part_number,model_number,is_active,catalog_visible',
    (query) => query.eq('is_active', true).neq('catalog_visible', false),
  ),
  fetchAll(
    'migration_redirects',
    'id,old_url,old_path,new_url,match_level,match_score,product_id,ebay_item_id,brand,part_number,product_name,is_active,redirect_enabled',
  ),
]);

const productBySlug = new Map();
const productByEbayId = new Map();
const exactTitleIndex = new Map();

for (const product of products) {
  if (!product.slug) continue;
  productBySlug.set(String(product.slug).toLowerCase(), product);
  if (product.ebay_item_id) indexUnique(productByEbayId, String(product.ebay_item_id), product);
  indexUnique(exactTitleIndex, normalizeText(product.name), product);
  indexUnique(exactTitleIndex, normalizeText(product.slug), product);
}

const redirectByPath = new Map();
for (const redirect of redirects) {
  if (redirect.old_path) redirectByPath.set(pathKey(redirect.old_path), redirect);
  if (redirect.old_url) redirectByPath.set(pathKey(redirect.old_url), redirect);
}

const validExisting = [];
const safeRepairs = [];
const brokenWithoutReplacement = [];
const unmatched = [];

for (const oldUrl of legacyUrls) {
  const oldPath = pathKey(oldUrl);
  const title = legacyTitleFromUrl(oldUrl);
  const redirectRow = redirectByPath.get(oldPath) || null;
  let resolvedProduct = null;

  if (redirectRow?.redirect_enabled && redirectRow?.is_active && redirectRow?.new_url) {
    const targetSlug = productSlugFromDestination(redirectRow.new_url);
    resolvedProduct = productBySlug.get(targetSlug.toLowerCase()) || null;

    if (!resolvedProduct) {
      const targetEbayId = ebayIdFromValue(targetSlug);
      const matches = uniqueById(productByEbayId.get(targetEbayId) || []);
      if (matches.length === 1) {
        resolvedProduct = matches[0];
        safeRepairs.push(repairRow(oldUrl, oldPath, resolvedProduct, 'COLLAPSE_STALE_PRODUCT_CHAIN', 100, redirectRow));
        continue;
      }
    }

    if (resolvedProduct) {
      validExisting.push({ oldUrl, newUrl: redirectRow.new_url });
      continue;
    }
  }

  const safeMatch = findSafeProduct(title, products, exactTitleIndex, redirectRow);
  if (safeMatch) {
    safeRepairs.push(repairRow(oldUrl, oldPath, safeMatch.product, safeMatch.reason, safeMatch.score, redirectRow));
  } else if (redirectRow?.redirect_enabled && redirectRow?.is_active) {
    brokenWithoutReplacement.push({ id: redirectRow.id, oldUrl, newUrl: redirectRow.new_url });
  } else {
    unmatched.push({ oldUrl, title });
  }
}

const report = {
  mode: APPLY ? 'apply' : 'dry-run',
  generatedAt: new Date().toISOString(),
  counts: {
    csvRows: csvRows.length,
    legacyProductUrls: legacyUrls.length,
    activeProducts: products.length,
    redirectRows: redirects.length,
    validExisting: validExisting.length,
    safeRepairs: safeRepairs.length,
    brokenDisabled: APPLY ? brokenWithoutReplacement.length : 0,
    brokenToDisable: brokenWithoutReplacement.length,
    unmatched: unmatched.length,
  },
  safeRepairs,
  brokenWithoutReplacement,
  unmatched,
};

if (APPLY) {
  await writeInChunks(safeRepairs);
  const ids = Array.from(new Set(brokenWithoutReplacement.map((item) => item.id).filter(Boolean)));
  for (let index = 0; index < ids.length; index += 100) {
    const { error } = await supabase
      .from('migration_redirects')
      .update({ redirect_enabled: false, updated_at: new Date().toISOString() })
      .in('id', ids.slice(index, index + 100));
    if (error) throw error;
  }
}

if (reportFile) {
  fs.writeFileSync(path.resolve(reportFile), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify({ ...report, safeRepairs: safeRepairs.slice(0, 20), brokenWithoutReplacement: brokenWithoutReplacement.slice(0, 20), unmatched: unmatched.slice(0, 20) }, null, 2));
