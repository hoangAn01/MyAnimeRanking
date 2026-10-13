const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { getAnimesCollection, handleAnimes } = require('./lib/animes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, 'public')));

app.all('/api/animes', handleAnimes);

app.get('/health', (req, res) => {
  res.send('OK');
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
  getAnimesCollection()
    .then(() => console.log('Connected successfully to MongoDB!'))
    .catch((err) => console.error('Failed to connect to MongoDB:', err.message));
}

module.exports = app;
