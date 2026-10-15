# MyAnimeRanking

Anime ranking frontend with a MongoDB API.

Live site: [https://my-anime-ranking-lime.vercel.app/](https://my-anime-ranking-bjwranj7n-hoangan01as-gmailcoms-projects.vercel.app/)

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
cp .env.example .env
# Set MONGODB_URI in .env to your MongoDB connection string.
npm start
```

Open http://localhost:3000. `PORT` is optional. Run `npm test` for HTTP and API regression checks; tests do not require MongoDB or change real anime data.

## Deploy to Vercel

Import this repository with the repository root as the Root Directory. The checked-in `vercel.json` selects the Other preset, skips the frontend build, and publishes `public`. Vercel deploys `api/animes.js` as the `/api/animes` Node.js function automatically. No legacy `builds`, catch-all routes, or separate backend URL is needed.

In **Project Settings > Environment Variables**, add `MONGODB_URI` for Production and Preview. Use an active MongoDB database user with access to `MyAnimeDB.Animes`, and ensure the database network configuration permits connections from the deployment. Save the environment variable and redeploy; existing deployments do not receive later environment changes.

After deployment, verify:

- `/` loads the ranking page, and `/style.css` and `/script.js` return assets.
- `GET /api/animes` returns a JSON array sorted by rating.
- If MongoDB is unavailable, the frontend still loads and the API returns JSON with HTTP 503 instead of crashing the function.

The local Express server and the Vercel function share the same API handler. Connections are opened on demand and reused across warm requests.

## GitHub Pages

The Pages workflow publishes only `public`. Pages cannot run the Node.js API, so its frontend calls the canonical Vercel API. Other hosts, including local development and Vercel previews, use their own `/api/animes` endpoint.

## Environment files

Keep `.env` local; it is excluded from source control and Vercel uploads. An earlier revision committed a database credential. Rotate that credential in MongoDB and update local and Vercel environment variables: deleting the file from the current revision does not remove it from Git history.
