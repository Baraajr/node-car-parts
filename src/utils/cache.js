/* eslint-disable new-cap */
/* eslint-disable prefer-rest-params */
const mongoose = require('mongoose');
const { createClient } = require('redis');

// const REDIS_HOST = 'localhost'; // or your Redis server address
// const REDIS_PORT = 6379;
const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.on('connect', () => console.log('Redis connected'));
client.connect(); // Important for Redis v4+

const { exec } = mongoose.Query.prototype;

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || '');
  return this; // Chainable
};

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify({
    ...this.getQuery(),
    collection: this.mongooseCollection.name,
  });

  const cacheValue = await client.hGet(this.hashKey, key);

  if (cacheValue) {
    console.log('from redis');
    const doc = JSON.parse(cacheValue);
    return Array.isArray(doc)
      ? doc.map((d) => new this.model(d))
      : new this.model(doc);
  }

  const result = await exec.apply(this, arguments);
  await client.hSet(this.hashKey, key, JSON.stringify(result));
  await client.expire(this.hashKey, 10); // Set expiration separately
  console.log('from mongo');

  return result;
};

module.exports = {
  async clearHash(hashKey) {
    await client.del(JSON.stringify(hashKey));
  },
};
