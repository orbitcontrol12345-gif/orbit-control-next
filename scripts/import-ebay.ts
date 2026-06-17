import { getEbayToken } from '../lib/ebay';

async function main() {
  const token = await getEbayToken();

  console.log('eBay Token Response:');
  console.log(token);
}

main();
