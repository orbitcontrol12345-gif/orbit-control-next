import { supabaseAdmin } from '../lib/supabase-admin';
import { getEbayToken } from '../lib/ebay';

const BATCH_SIZE = 100;
const CONCURRENCY = 5;
const DRY_RUN = process.env.DRY_RUN !== 'false';
const MAX_PRODUCTS = Number(process.env.MAX_PRODUCTS || 50);

const INVALID_EBAY_VALUES =
  /^(DOES NOT APPLY|NOT APPLICABLE|N\/A|NA|NONE|UNKNOWN|UNBRANDED)$/i;

function normalize(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function isValidEbayValue(value: string, ebayItemId: string) {
  const normalized = normalize(value);
  const normalizedItemId = normalize(ebayItemId);

  if (!normalized) return false;
  if (normalized.length > 80) return false;
  if (INVALID_EBAY_VALUES.test(normalized)) return false;
  if (normalized === normalizedItemId) return false;
  if (/^27\d{10}$/.test(normalized)) return false;

  return true;
}

function getAspectValue(item: any, names: string[]) {
  const aspects = Array.isArray(item?.localizedAspects)
    ? item.localizedAspects
    : [];

  const wanted = new Set(names.map((name) => name.toLowerCase()));

  const found = aspects.find((aspect: any) =>
    wanted.has(String(aspect?.name || '').trim().toLowerCase())
  );

  return normalize(found?.value);
}

function getEbayIdentifiers(item: any, ebayItemId: string) {
  const ebayMpn = getAspectValue(item, [
    'mpn',
    'manufacturer part number',
  ]);

  const ebayModel = getAspectValue(item, [
    'model',
    'model number',
  ]);

  const validMpn = isValidEbayValue(ebayMpn, ebayItemId)
    ? ebayMpn
    : '';

  const validModel = isValidEbayValue(ebayModel, ebayItemId)
    ? ebayModel
    : '';

  return {
    ebayMpn: validMpn,
    ebayModel: validModel,
    partNumber: validMpn || validModel || 'UNKNOWN',
    modelNumber: validModel || 'UNKNOWN',
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEbayItem(
  accessToken: string,
  ebayItemId: string,
  attempt = 1
): Promise<any | null> {
  const url =
    'https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id' +
    `?legacy_item_id=${encodeURIComponent(ebayItemId)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Accept-Language': 'en-US',
    },
  });

  if (response.ok) {
    return response.json();
  }

  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get('retry-after') || 0);
    const waitMs = retryAfter > 0
      ? retryAfter * 1000
      : attempt * 2000;

    await sleep(waitMs);
    return fetchEbayItem(accessToken, ebayItemId, attempt + 1);
  }

  const body = await response.text().catch(() => '');
  console.error(
    `EBAY FETCH FAILED ${ebayItemId}: ${response.status} ${body.slice(0, 200)}`
  );

  return null;
}

async function main() {
  const { access_token } = await getEbayToken();
  const accessToken = String(access_token || '').trim();

  if (!accessToken) {
    throw new Error('Could not obtain an eBay access token.');
  }

  let from = 0;
  let scanned = 0;
  let repaired = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  while (true) {
    const remaining =
      MAX_PRODUCTS > 0
        ? MAX_PRODUCTS - scanned
        : BATCH_SIZE;

    if (MAX_PRODUCTS > 0 && remaining <= 0) break;

    const currentBatchSize = Math.min(BATCH_SIZE, remaining);

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(
        'id,ebay_item_id,part_number,model_number,marketplace,source_type'
      )
      .not('ebay_item_id', 'is', null)
      .order('id')
      .range(from, from + currentBatchSize - 1);

    if (error) throw error;
    if (!products?.length) break;

    for (let i = 0; i < products.length; i += CONCURRENCY) {
      const chunk = products.slice(i, i + CONCURRENCY);

      const details = await Promise.all(
        chunk.map((product) =>
          fetchEbayItem(accessToken, String(product.ebay_item_id || ''))
        )
      );

      for (let index = 0; index < chunk.length; index++) {
        const product = chunk[index];
        const item = details[index];

        scanned++;

        const ebayItemId = String(product.ebay_item_id || '').trim();

        if (!ebayItemId || !item) {
          failed++;
          continue;
        }

        const {
          ebayMpn,
          ebayModel,
          partNumber,
          modelNumber,
        } = getEbayIdentifiers(item, ebayItemId);

        if (!ebayMpn && !ebayModel) {
          skipped++;
          console.log(
            `SKIP ${product.id} (${ebayItemId}): eBay has no valid MPN or Model`
          );
          continue;
        }

        const oldPart = normalize(product.part_number);
        const oldModel = normalize(product.model_number);

        const partChanged = oldPart !== partNumber;
        const modelChanged = oldModel !== modelNumber;

        if (!partChanged && !modelChanged) {
          unchanged++;
          continue;
        }

        if (DRY_RUN) {
          repaired++;
          console.log(
            [
              `PREVIEW ${product.id} (${ebayItemId})`,
              `part: ${oldPart || '(empty)'} => ${partNumber}`,
              `model: ${oldModel || '(empty)'} => ${modelNumber}`,
              `eBay MPN: ${ebayMpn || '(empty)'}`,
              `eBay Model: ${ebayModel || '(empty)'}`,
            ].join(' | ')
          );
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({
            part_number: partNumber,
            model_number: modelNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          failed++;
          console.error(
            `UPDATE FAILED ${product.id} (${ebayItemId}): ${updateError.message}`
          );
          continue;
        }

        repaired++;
        console.log(
          `UPDATED ${product.id} (${ebayItemId}): ` +
            `part ${oldPart || '(empty)'} => ${partNumber}, ` +
            `model ${oldModel || '(empty)'} => ${modelNumber}`
        );
      }
    }

    if (MAX_PRODUCTS > 0 && scanned >= MAX_PRODUCTS) break;

    from += products.length;
  }

  console.log('Finished');
  console.log({
    dryRun: DRY_RUN,
    maxProducts: MAX_PRODUCTS,
    scanned,
    repaired,
    unchanged,
    skipped,
    failed,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
