export async function getEbayToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(
    'https://api.ebay.com/identity/v1/oauth2/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body:
        'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(`eBay token error: ${JSON.stringify(data)}`);
  }

  return data;
}
