import {
  loadUnknownProducts,
  loadRegistryBrands,
} from './brand-repository';

export class BrandEngine {
  async learn() {
    const products = await loadUnknownProducts(5000);
    const registry = await loadRegistryBrands();

    return {
      success: true,
      unknownProducts: products.length,
      knownBrands: registry.length,
    };
  }

  async extract() {
    const products = await loadUnknownProducts(5000);

    return {
      success: true,
      products,
    };
  }

  async promote() {
    throw new Error('Not implemented');
  }

  async apply() {
    throw new Error('Not implemented');
  }

  async resolve() {
    throw new Error('Not implemented');
  }
}

export const brandEngine = new BrandEngine();
