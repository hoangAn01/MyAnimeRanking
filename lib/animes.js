const { MongoClient } = require('mongodb');

let collectionPromise;

function getAnimesCollection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return Promise.reject(new Error('MONGODB_URI is not set'));
  if (!collectionPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    collectionPromise = client
      .connect()
      .then(() => client.db('MyAnimeDB').collection('Animes'))
      .catch((err) => {
        collectionPromise = null;
        throw err;
      });
  }
  return collectionPromise;
}

async function handleAnimes(req, res) {
  let animes;
  try {
    animes = await getAnimesCollection();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    return res.status(503).json({ message: 'Không kết nối được database.' });
  }

  try {
    if (req.method === 'GET') {
      const allAnimes = await animes.find({}).sort({ rating: -1 }).toArray();
      return res.status(200).json(allAnimes);
    }
    if (req.method === 'POST') {
      const { title, rating, genre, description, imgURL } = req.body || {};
      if (!title || !rating || !genre || !description || !imgURL) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
      }
      const newAnime = { title, rating: parseFloat(rating), genre, description, imgURL };
      await animes.insertOne(newAnime);
      return res.status(201).json({ message: 'Thêm anime thành công!', anime: newAnime });
    }
    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

module.exports = { getAnimesCollection, handleAnimes };
