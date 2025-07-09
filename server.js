const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, 'public')));

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    console.log("Connected successfully to MongoDB!");
    const database = client.db('MyAnimeDB');
    const animes = database.collection('Animes');

    // API endpoint to get all anime
    app.get('/api/animes', async (req, res) => {
      try {
        const allAnimes = await animes.find({}).sort({ rating: -1 }).toArray();
        res.json(allAnimes);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    // API endpoint to add a new anime (with simple auth)
    app.post('/api/animes', async (req, res) => {
      try {
        const { username, password, title, rating, genre, description, imgURL } = req.body;
        if (username !== 'a123' || password !== 'a123') {
          return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu!' });
        }
        if (!title || !rating || !genre || !description || !imgURL) {
          return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
        }
        const newAnime = { title, rating: parseFloat(rating), genre, description, imgURL };
        const result = await animes.insertOne(newAnime);
        res.status(201).json({ message: 'Thêm anime thành công!', anime: newAnime });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }
}

run().catch(console.dir);

app.get('/health', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});