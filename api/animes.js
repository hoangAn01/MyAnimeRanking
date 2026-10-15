const { MongoClient } = require('mongodb');

let collectionPromise;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Database is not configured.');
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    return client.db('MyAnimeDB').collection('Animes');
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

function getCollection() {
  if (!collectionPromise) {
    // Reuse a connection across warm requests, but allow failed attempts to retry.
    collectionPromise = connectDB().catch((error) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  let newAnime;
  if (req.method === 'POST') {
    let body;
    try {
      body = req.body || {};
    } catch {
      return res.status(400).json({ message: 'Dữ liệu JSON không hợp lệ.' });
    }
    const { title, rating, genre, description, imgURL } = body;
    if (!title || rating === undefined || rating === null || rating === '' || !genre || !description || !imgURL) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    const numericRating = typeof rating === 'number' || (typeof rating === 'string' && rating.trim())
      ? Number(rating)
      : NaN;
    if (!Number.isFinite(numericRating) || numericRating < 0 || numericRating > 10) {
      return res.status(400).json({ message: 'Điểm đánh giá phải từ 0 đến 10.' });
    }
    newAnime = { title, rating: numericRating, genre, description, imgURL };
  }

  try {
    const animes = await getCollection();
    if (req.method === 'GET') {
      const allAnimes = await animes.find({}).sort({ rating: -1 }).toArray();
      return res.status(200).json(allAnimes);
    }

    await animes.insertOne(newAnime);
    return res.status(201).json({ message: 'Thêm anime thành công!', anime: newAnime });
  } catch {
    return res.status(503).json({ message: 'Dữ liệu tạm thời không khả dụng. Vui lòng thử lại sau.' });
  }
};
