import type { Product } from '@/lib/types';

const BASE_URL = process.env.WOOCOMMERCE_BASE_URL;
const KEY = process.env.WOOCOMMERCE_CONSUMER_KEY;
const SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET;

function stripHtml(value?: string) {
  return value ? value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '';
}

function extractPartNumber(item: any) {
  const name = String(item.name || '');
  const sku = String(item.sku || '');

  const cleanName = name.replace(sku, ' ');

  const words = cleanName
    .split(/\s+/)
    .map((w) => w.replace(/[(),:"']/g, '').trim())
    .filter(Boolean);

  const ignore = new Set([
    'SICK', 'PILZ', 'SIEMENS', 'SCHNEIDER', 'ELECTRIC', 'ALLEN', 'BRADLEY',
    'HONEYWELL', 'OMRON', 'ABB', 'KOMYO', 'AIREDALE', 'CAREL',
    'NEW', 'USED', 'LOT', 'PCS', 'WITH', 'WITHOUT', 'BOX', 'BASE',
    'MODULE', 'SENSOR', 'CONTROLLER', 'SAFETY', 'PHOTOELECTRIC',
  ]);

  const candidates = words.filter((w) => {
    const upper = w.toUpperCase();
    if (ignore.has(upper)) return false;
    if (upper.startsWith('XEL-')) return false;
    if (upper === sku.toUpperCase()) return false;
    if (!/\d/.test(w)) return false;
    if (w.length < 5) return false;
    return true;
  });

  const withDash = candidates.find((w) => /[-/]/.test(w));
  const longNumber = candidates.find((w) => /^\d{5,}$/.test(w));
  const any = candidates[0];

  return withDash || longNumber || any || name;
}

function mapWooProduct(item: any): Product {
  const category = item.categories?.[0]?.name || 'Industrial Parts';

  const brand =
    item.brands?.[0]?.name ||
    item.categories?.find((c: any) =>
      [
        'abb',
        'siemens',
        'schneider',
        'schneider electric',
        'allen-bradley',
        'allen bradley',
        'omron',
        'honeywell',
        'yokogawa',
        'phoenix contact',
        'mitsubishi',
        'fanuc',
        'keyence',
      ].includes(c.name?.toLowerCase())
    )?.name ||
    item.attributes?.find((a: any) =>
      a.name?.toLowerCase().includes('brand')
    )?.options?.[0] ||
    'Industrial';

  const partNumber = extractPartNumber(item);

  return {
    id: String(item.id),
    sku: item.sku || String(item.id),
    brand,
    partNumber,
    name: item.name,
    category,
    condition:
  item.attributes?.find((a: any) =>
    a.name?.toLowerCase().includes('condition')
  )?.options?.[0] || 'Used',

    inStock: item.stock_status === 'instock',
    description: stripHtml(item.short_description || item.description),
    technicalSpecs: {},
    imageUrl: item.images?.[0]?.src || '/placeholder-product.jpg',
    tags: [
      partNumber,
      item.name,
      brand,
      category,
      ...(item.tags?.map((t: any) => t.name) || []),
    ].filter(Boolean),
    slug: item.slug,
  };
}

async function wooFetch(path: string) {
  if (!BASE_URL || !KEY || !SECRET) {
    return {
      data: [],
      totalProducts: 0,
      totalPages: 0,
    };
  }

  const auth = Buffer.from(`${KEY}:${SECRET}`).toString('base64');

  const res = await fetch(`${BASE_URL}/wp-json/wc/v3/${path}`, {
  headers: {
    Authorization: `Basic ${auth}`,
  },
  next: {
    revalidate: 3600,
  },
});

  if (!res.ok) {
    return {
      data: [],
      totalProducts: 0,
      totalPages: 0,
    };
  }

  const data = await res.json();

  return {
    data,
    totalProducts: Number(res.headers.get('X-WP-Total') || 0),
    totalPages: Number(res.headers.get('X-WP-TotalPages') || 0),
  };
}

export async function getWooProducts({
  search = '',
  page = 1,
  perPage = 24,
}: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const params = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
    status: 'publish',
  });

  if (search) params.set('search', search);

  const result = await wooFetch(`products?${params.toString()}`);

  return {
    products: Array.isArray(result.data)
      ? result.data.map(mapWooProduct)
      : [],
    totalProducts: result.totalProducts,
    totalPages: result.totalPages,
  };
}

export async function getWooProductBySlug(slug: string): Promise<Product | null> {
  const params = new URLSearchParams({
    slug,
    per_page: '1',
    status: 'publish',
  });

  const result = await wooFetch(
  `products?${params.toString()}`
);

const data = result.data;

return Array.isArray(data) && data[0]
  ? mapWooProduct(data[0])
  : null;
}

export async function getWooRelatedProducts(product: Product): Promise<Product[]> {
  const { products } = await getWooProducts({
    search: product.brand || product.category || '',
    perPage: 4,
  });

  return products;
}

export async function getWooCategoryBySlug(slug: string) {
  const result = await wooFetch(
    `products/categories?slug=${encodeURIComponent(slug)}&per_page=1`
  );

  const data = result.data;

return Array.isArray(data) && data[0]
  ? data[0]
  : null;
}

export async function getWooProductsByBrandSlug(
  brandSlug: string,
  page = 1,
  perPage = 24
): Promise<{
  products: Product[];
  totalProducts: number;
  totalPages: number;
}> {
  const aliases: Record<string, string[]> = {
    abb: ["abb"],
    siemens: ["siemens"],
    schneider: ["schneider", "schneider electric"],
    "allen-bradley": ["allen-bradley", "allen bradley", "rockwell", "rockwell automation"],
    omron: ["omron"],
    honeywell: ["honeywell"],
    yokogawa: ["yokogawa"],
    phoenix: ["phoenix", "phoenix contact"],
    "ge-fanuc": ["ge fanuc", "ge-fanuc", "fanuc", "general electric"],
    mitsubishi: ["mitsubishi", "mitsubishi electric"],
    beckhoff: ["beckhoff"],
    keyence: ["keyence"],
  };

  const key = brandSlug.toLowerCase().trim();
  const searchTerms = aliases[key] || [key.replace(/-/g, " "), key];

  const results = await Promise.all(
    searchTerms.map((term) =>
      getWooProducts({
        search: term,
        page,
        perPage,
      })
    )
  );

  const products = results.flatMap((result) => result.products);

  const uniqueProducts = products.filter(
    (product, index, self) =>
      index === self.findIndex((p) => p.id === product.id)
  );

  const totalProducts = results.reduce(
    (sum, result) => sum + (result.totalProducts || 0),
    0
  );

  return {
    products: uniqueProducts,
    totalProducts,
    totalPages: Math.max(1, Math.ceil(totalProducts / perPage)),
  };
}
export async function getWooProductsPage({
  search = '',
  page = 1,
  perPage = 24,
}: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  if (!BASE_URL || !KEY || !SECRET) {
    return { products: [], totalProducts: 0, totalPages: 0 };
  }

  const auth = Buffer.from(`${KEY}:${SECRET}`).toString('base64');

  const params = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
    status: 'publish',
  });

  if (search) params.set('search', search);

  const res = await fetch(`${BASE_URL}/wp-json/wc/v3/products?${params.toString()}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return { products: [], totalProducts: 0, totalPages: 0 };
  }

  const data = await res.json();

  return {
    products: Array.isArray(data) ? data.map(mapWooProduct) : [],
    totalProducts: Number(res.headers.get('X-WP-Total') || 0),
    totalPages: Number(res.headers.get('X-WP-TotalPages') || 0),
  };
}
  

export async function getWooProductsByCategorySlug(
  categorySlug: string,
  page = 1,
  perPage = 24
): Promise<{
  products: Product[];
  totalProducts: number;
  totalPages: number;
}> {

  const keywordMap: Record<string, string[]> = {
    plcs: ['PLC', 'CPU', 'MODULE', 'PROCESSOR'],
    hmis: ['HMI', 'TOUCH', 'PANEL', 'SCREEN', 'OPERATOR'],
    'drives-vfds': ['DRIVE', 'VFD', 'INVERTER', 'SERVO'],
    sensors: ['SENSOR', 'PHOTOELECTRIC', 'PROXIMITY'],
    'circuit-breakers': ['BREAKER', 'MCCB', 'MCB', 'ACB'],
    relays: ['RELAY'],
    'power-supplies': ['POWER SUPPLY', 'PSU'],
    'control-boards': ['BOARD', 'PCB', 'CONTROL BOARD'],
    contactors: ['CONTACTOR'],
    'obsolete-parts': ['OBSOLETE', 'DISCONTINUED'],
  };

  const keywords = keywordMap[categorySlug] || [categorySlug];

  let results: Product[] = [];

  for (const keyword of keywords) {
    const { products } = await getWooProductsPage({
      search: keyword,
      page: 1,
      perPage: 100,
    });

    results.push(...products);
  }

  const unique = Array.from(
    new Map(results.map((product) => [product.id, product])).values()
  );

  const totalProducts = unique.length;
  const totalPages = Math.ceil(totalProducts / perPage);

  const start = (page - 1) * perPage;
  const end = start + perPage;

  return {
    products: unique.slice(start, end),
    totalProducts,
    totalPages,
  };
}
