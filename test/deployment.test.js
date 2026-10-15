const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const dotenv = require('dotenv');
const realMongo = require('mongodb');

const serverPath = require.resolve('../server');
const handlerPath = require.resolve('../api/animes');
const mongoPath = require.resolve('mongodb');
const exampleAnime = {
  title: 'Steins;Gate', rating: '9.2', genre: 'Sci-Fi',
  description: 'Time travel', imgURL: 'https://example.test/anime.jpg',
};

// Each scenario has its own connection cache. Never read a developer's .env or
// contact an external database, even if one is configured on the test machine.
async function withRuntime({ uri = '', MongoClient = realMongo.MongoClient } = {}, run) {
  const previousUri = process.env.MONGODB_URI;
  const previousConfig = dotenv.config;
  const previousModules = [serverPath, handlerPath, mongoPath].map((path) => require.cache[path]);
  process.env.MONGODB_URI = uri;
  dotenv.config = () => ({ parsed: {} });
  require.cache[mongoPath] = {
    ...require.cache[mongoPath], exports: { ...realMongo, MongoClient },
  };
  delete require.cache[serverPath];
  delete require.cache[handlerPath];
  try {
    const app = require(serverPath);
    const handler = require(handlerPath);
    await run({ app, handler });
  } finally {
    dotenv.config = previousConfig;
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    [serverPath, handlerPath, mongoPath].forEach((path, index) => {
      if (previousModules[index]) require.cache[path] = previousModules[index];
      else delete require.cache[path];
    });
  }
}

async function withHttp(app, run) {
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections();
    });
  }
}

async function invoke(handler, method, body) {
  return invokeRequest(handler, { method, body });
}

async function invokeRequest(handler, request) {
  const response = {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
  await handler(request, response);
  return response;
}

function fakeDatabase({ rows = [], connect = async () => {}, readError, writeError } = {}) {
  const state = { clients: 0, connections: 0, closes: 0, inserts: [] };
  const documents = structuredClone(rows);
  class MongoClient {
    constructor() { state.clients += 1; }
    async connect() { state.connections += 1; await connect(state.connections); return this; }
    async close() { state.closes += 1; }
    db() {
      return {
        collection() {
          return {
            find() {
              let order;
              return {
                sort(value) { order = value; return this; },
                async toArray() {
                  if (readError) throw readError;
                  const result = structuredClone(documents);
                  if (order) {
                    for (const [key, direction] of Object.entries(order).reverse()) {
                      result.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * direction);
                    }
                  }
                  return result;
                },
              };
            },
            async insertOne(document) {
              if (writeError) throw writeError;
              state.inserts.push(structuredClone(document));
              documents.push(structuredClone(document));
              return { acknowledged: true, insertedId: 'test-id' };
            },
          };
        },
      };
    }
  }
  return { MongoClient, state };
}

test('local server serves the page and its assets while MongoDB is unconfigured', async () => {
  await withRuntime({}, async ({ app }) => withHttp(app, async (base) => {
    const root = await fetch(base);
    assert.equal(root.status, 200);
    assert.match(root.headers.get('content-type'), /text\/html/);
    const html = await root.text();
    assert.match(html, /<title>.*Anime.*<\/title>/);
    const assets = [
      [html.match(/rel="stylesheet" href="([^"]+)"/)[1], /text\/css/],
      [html.match(/<script src="([^"]+)"/)[1], /javascript/],
      [html.match(/rel="icon" href="([^"]+)"/)[1], /image\/jpeg/],
    ];
    for (const [path, type] of assets) {
      const response = await fetch(new URL(path, base));
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('content-type'), type, path);
      assert.ok((await response.arrayBuffer()).byteLength > 0, path);
    }
    const video = html.match(/<source src="([^"]+)"/)[1];
    const clip = await fetch(new URL(video, base), { headers: { Range: 'bytes=0-31' } });
    assert.equal(clip.status, 206);
    assert.match(clip.headers.get('content-type'), /video\/mp4/);
    assert.match(clip.headers.get('content-range'), /^bytes 0-31\/\d+$/);
    assert.equal((await clip.arrayBuffer()).byteLength, 32);

    const api = await fetch(`${base}/api/animes`);
    assert.equal(api.status, 503);
    assert.equal(typeof (await api.json()).message, 'string');
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), 'OK');
  }));
});

test('invalid MongoDB configuration returns safe JSON without taking the server down', async () => {
  class NoNetworkMongoClient extends realMongo.MongoClient {
    connect() { throw new Error('Tests must never open a database connection'); }
  }
  await withRuntime({ uri: 'invalid-mongodb-uri', MongoClient: NoNetworkMongoClient }, async ({ app }) => {
    await withHttp(app, async (base) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(`${base}/api/animes`);
        assert.equal(response.status, 503);
        assert.match(response.headers.get('content-type'), /application\/json/);
        const body = await response.json();
        assert.equal(typeof body.message, 'string');
        assert.doesNotMatch(JSON.stringify(body), /invalid-mongodb-uri|MongoParseError|stack/i);
      }
      assert.equal((await fetch(base)).status, 200);
      assert.equal(await (await fetch(`${base}/health`)).text(), 'OK');
    });
  });
});

test('serverless API answers CORS preflight and unsupported methods before opening MongoDB', async () => {
  class ForbiddenMongoClient {
    constructor() { assert.fail('Method handling must not open MongoDB'); }
  }
  await withRuntime({ uri: 'mongodb://unused.test', MongoClient: ForbiddenMongoClient }, async ({ handler }) => {
    const preflight = await invoke(handler, 'OPTIONS');
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.body, undefined);
    assert.equal(preflight.headers['access-control-allow-origin'], '*');
    assert.match(preflight.headers['access-control-allow-headers'], /content-type/i);
    assert.deepEqual(new Set(preflight.headers['access-control-allow-methods'].split(/,\s*/)), new Set(['GET', 'POST', 'OPTIONS']));
    for (const method of ['PUT', 'PATCH', 'DELETE', 'HEAD']) {
      const response = await invoke(handler, method);
      assert.equal(response.statusCode, 405, method);
      assert.deepEqual(new Set(response.headers.allow.split(/,\s*/)), new Set(['GET', 'POST', 'OPTIONS']));
      assert.equal(typeof response.body.message, 'string');
      assert.equal(response.headers['access-control-allow-origin'], '*');
    }
  });
});

test('HTTP API reads ratings in descending order and persists a valid anime with a numeric rating', async () => {
  const mock = fakeDatabase({ rows: [{ title: 'Lower', rating: 6 }, { title: 'Higher', rating: 9.8 }] });
  await withRuntime({ uri: 'mongodb://unused.test', MongoClient: mock.MongoClient }, async ({ app }) => {
    await withHttp(app, async (base) => {
      const get = await fetch(`${base}/api/animes`);
      assert.equal(get.status, 200);
      assert.deepEqual((await get.json()).map((anime) => anime.title), ['Higher', 'Lower']);
      const post = await fetch(`${base}/api/animes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exampleAnime),
      });
      assert.equal(post.status, 201);
      const created = (await post.json()).anime;
      assert.deepEqual(created, { ...exampleAnime, rating: 9.2 });
      assert.deepEqual(mock.state.inserts, [created]);
      const reread = await fetch(`${base}/api/animes`);
      assert.deepEqual((await reread.json()).map((anime) => anime.title), ['Higher', 'Steins;Gate', 'Lower']);
      assert.equal(mock.state.connections, 1);
    });
  });
});

test('invalid submissions fail validation without connecting to MongoDB', async () => {
  const mock = fakeDatabase();
  await withRuntime({ uri: 'mongodb://unused.test', MongoClient: mock.MongoClient }, async ({ handler }) => {
    for (const body of [undefined, {}, { ...exampleAnime, title: '' },
      ...['', null, -1, 11, 'NaN', 'Infinity', true, [], {}].map((rating) => ({ ...exampleAnime, rating }))]) {
      const response = await invoke(handler, 'POST', body);
      assert.equal(response.statusCode, 400, JSON.stringify(body));
      assert.equal(typeof response.body.message, 'string');
    }
    assert.equal(mock.state.clients, 0);
    assert.equal(mock.state.inserts.length, 0);
  });
});

test('malformed JSON returns 400 in both the serverless handler and local HTTP server', async () => {
  const mock = fakeDatabase();
  await withRuntime({ uri: 'mongodb://unused.test', MongoClient: mock.MongoClient }, async ({ app, handler }) => {
    const request = {
      method: 'POST',
      get body() { throw new SyntaxError('Unexpected token in private-payload'); },
    };
    const direct = await invokeRequest(handler, request);
    assert.equal(direct.statusCode, 400);
    assert.equal(typeof direct.body.message, 'string');
    assert.doesNotMatch(JSON.stringify(direct.body), /private-payload|SyntaxError|stack/);
    assert.equal(direct.headers['access-control-allow-origin'], '*');

    // Express suppresses expected parser-error logging in its test environment.
    app.set('env', 'test');
    await withHttp(app, async (base) => {
      const response = await fetch(`${base}/api/animes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"title":',
      });
      assert.equal(response.status, 400);
      await response.text();
      assert.equal(await (await fetch(`${base}/health`)).text(), 'OK');
    });
    assert.equal(mock.state.clients, 0);
    assert.equal(mock.state.inserts.length, 0);
  });
});

test('concurrent and subsequent serverless requests reuse one MongoDB connection', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const mock = fakeDatabase({ connect: () => gate });
  await withRuntime({ uri: 'mongodb://unused.test', MongoClient: mock.MongoClient }, async ({ handler }) => {
    const pending = [invoke(handler, 'GET'), invoke(handler, 'GET'), invoke(handler, 'POST', exampleAnime)];
    assert.equal(mock.state.connections, 1);
    release();
    const responses = await Promise.all(pending);
    assert.deepEqual(responses.map((response) => response.statusCode), [200, 200, 201]);
    assert.equal((await invoke(handler, 'GET')).statusCode, 200);
    assert.equal(mock.state.clients, 1);
    assert.equal(mock.state.connections, 1);
  });
});

test('a failed MongoDB connection is closed and a later request retries successfully', async () => {
  const mock = fakeDatabase({ connect: async (attempt) => {
    if (attempt === 1) throw new Error('private-database-host-and-password');
  } });
  await withRuntime({ uri: 'mongodb://unused.test', MongoClient: mock.MongoClient }, async ({ handler }) => {
    const failed = await invoke(handler, 'GET');
    assert.equal(failed.statusCode, 503);
    assert.doesNotMatch(JSON.stringify(failed.body), /private-database|password|stack/);
    assert.equal(mock.state.closes, 1);
    const retried = await invoke(handler, 'GET');
    assert.equal(retried.statusCode, 200);
    assert.deepEqual(retried.body, []);
    assert.equal(mock.state.connections, 2);
    assert.equal(mock.state.clients, 2);
  });
});

test('database query and insert failures return safe 503 responses', async () => {
  const error = new Error('private-database-host-and-password');
  const mock = fakeDatabase({ readError: error, writeError: error });
  await withRuntime({ uri: 'mongodb://unused.test', MongoClient: mock.MongoClient }, async ({ handler }) => {
    for (const method of ['GET', 'POST']) {
      const response = await invoke(handler, method, exampleAnime);
      assert.equal(response.statusCode, 503, method);
      assert.equal(typeof response.body.message, 'string');
      assert.doesNotMatch(JSON.stringify(response.body), /private-database|password|stack/);
      assert.equal(response.headers['access-control-allow-origin'], '*');
    }
  });
});
