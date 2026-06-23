import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SELLER = "orbitcontrol";
const MARKETPLACE = "EBAY_US";
const LIMIT = 200;

const KEYWORDS = [
  "siemens",
  "allen bradley",
  "schneider",
  "abb",
  "omron",
  "mitsubishi",
  "ge",
  "fanuc",
  "yaskawa",
  "cutler hammer",
  "eaton",
  "honeywell",
  "bently nevada",
  "rexroth",
  "keyence",
  "sensor",
  "plc",
  "hmi",
  "vfd",
  "relay",
  "contactor",
  "circuit breaker",
  "power supply",
  "module",
  "controller",
  "drive",
  "board",
  "panel",
  "processor",
  "temperature",
  "pressure",
  "encoder",
  "servo",
];

async function getEbayToken() {
  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.access_token as string;
}

function cleanText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getPartNumber(title: string) {
  const clean = title
    .replace(/\bNEW\b|\bUSED\b|\bOPEN BOX\b|\bLOT\b|\bTESTED\b/gi, "")
    .trim();

  const match = clean.match(/[A-Z0-9][A-Z0-9\-\/\.]{3,}[A-Z0-9]/i);
  return match ? match[0].toUpperCase() : "UNKNOWN";
}

function slugify(text: string, itemId: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) + `-${itemId}`
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("secret") !== process.env.ADMIN_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keywordIndex = Number(searchParams.get("keywordIndex") || "0");
  const offset = Number(searchParams.get("offset") || "0");

  const q = KEYWORDS[keywordIndex];
  if (!q) {
    return NextResponse.json({
      success: true,
      message: "All keywords completed",
      totalKeywords: KEYWORDS.length,
    });
  }

  const token = await getEbayToken();

  const url =
    `https://api.ebay.com/buy/browse/v1/item_summary/search?` +
    new URLSearchParams({
      q,
      limit: String(LIMIT),
      offset: String(offset),
      filter: `sellers:{${SELLER}},itemLocationCountry:US`,
    });

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { success: false, q, offset, error: data },
      { status: 500 }
    );
  }

  const items = data.itemSummaries || [];

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const ebayItemId = cleanText(item.itemId).replace("v1|", "").split("|")[0];
      const title = cleanText(item.title);
      const brand = cleanText(item.brand) || "Unknown";
      const partNumber = getPartNumber(title);
      const imageUrl = item.image?.imageUrl || null;
      const price = Number(item.price?.value || 0);
      const condition = cleanText(item.condition) || "Used";

      if (!ebayItemId || !title) {
        skipped++;
        continue;
      }

      const payload = {
        ebay_item_id: ebayItemId,
        sku: ebayItemId,
        part_number: partNumber,
        model_number: partNumber,
        brand,
        category: cleanText(item.categoryPath) || "Industrial Automation",
        name: title,
        condition,
        image_url: imageUrl,
        description: title,
        slug: slugify(title, ebayItemId),
        marketplace: MARKETPLACE,
        seller: SELLER,
        source: "ebay-backfill-keywords",
        source_type: "ebay",
        quantity: 1,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        price,
        currency: item.price?.currency || "USD",
      };

      const { error } = await supabase
        .from("products")
        .upsert(payload, { onConflict: "ebay_item_id", ignoreDuplicates: true });

      if (error) {
        failed++;
      } else {
        inserted++;
      }
    } catch {
      failed++;
    }
  }

  const nextOffset = offset + LIMIT;
  const nextKeywordIndex =
    items.length < LIMIT ? keywordIndex + 1 : keywordIndex;

  return NextResponse.json({
    success: true,
    q,
    keywordIndex,
    offset,
    received: items.length,
    inserted,
    skipped,
    failed,
    nextUrl:
      items.length < LIMIT
        ? `/api/admin/ebay-backfill?secret=${process.env.ADMIN_CRON_SECRET}&keywordIndex=${nextKeywordIndex}&offset=0`
        : `/api/admin/ebay-backfill?secret=${process.env.ADMIN_CRON_SECRET}&keywordIndex=${keywordIndex}&offset=${nextOffset}`,
  });
}
