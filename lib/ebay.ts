export async function getEbayToken() {
  const auth = Buffer.from(
  `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
).toString('base64');

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

return data;

return data.access_token;
}
