const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
let animes;

async function connectDB() {
  if (!animes) {
    await client.connect();
    const database = client.db('MyAnimeDB');
    animes = database.collection('Animes');
  }
}

module.exports = async (req, res) => {
  await connectDB();

  if (req.method === 'GET') {
    try {
      const allAnimes = await animes.find({}).sort({ rating: -1 }).toArray();
      res.status(200).json(allAnimes);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { title, rating, genre, description, imgURL } = req.body;
      if (!title || !rating || !genre || !description || !imgURL) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
      }
      const newAnime = { title, rating: parseFloat(rating), genre, description, imgURL };
      await animes.insertOne(newAnime);
      res.status(201).json({ message: 'Thêm anime thành công!', anime: newAnime });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
};
