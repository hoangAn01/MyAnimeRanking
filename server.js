const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const animeHandler = require('./api/animes');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.all('/api/animes', animeHandler);

app.get('/health', (req, res) => {
  res.send('OK');
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = app;
