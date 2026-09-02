import 'dotenv/config';

const secretKey = process.env.PAYMOB_SECRET_KEY;
const baseUrl = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com';

async function check() {
  const headers = {
    'Authorization': \Token \\,
    'Content-Type': 'application/json'
  };

  try {
    const res1 = await fetch(\\/api/acceptance/transactions?order_id=600190070\, { headers });
    console.log('Res1 status:', res1.status);
    const data1 = await res1.json();
    console.log('Res1 data count:', data1?.results?.length || (Array.isArray(data1) ? data1.length : 'unknown'));
    console.log('Res1 sample:', JSON.stringify(data1?.results?.[0] || data1, null, 2));
  } catch (e) {
    console.error('Error 1:', e.message);
  }
}

check();
