
import { createClient } from '@vercel/kv';

export default async function handler(request, response) {
  // This is a temporary endpoint for administrative purposes.
  // It should be removed after use.
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      return response.status(500).json({ error: 'KV store is not configured.' });
    }
    const kv = createClient({ url, token });

    const keysToDelete = [
      'scores:time_attack:all',
      'scores:speed_run:all',
      'scores:time_attack',
      'scores:speed_run'
    ];

    const results = await Promise.all(keysToDelete.map(key => kv.del(key)));

    return response.status(200).json({ 
      message: 'Successfully cleared legacy score keys.',
      details: keysToDelete.map((key, index) => ({
        key,
        deleted: results[index] === 1 ? 'Yes' : 'No (or key did not exist)'
      }))
    });

  } catch (error) {
    console.error('Error clearing scores:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
