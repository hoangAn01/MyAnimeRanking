const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://myanimeranking.onrender.com'
}));
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
    app.get('/animes', async (req, res) => {
      try {
        const allAnimes = await animes.find({}).sort({ rating: -1 }).toArray();
        res.json(allAnimes);
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