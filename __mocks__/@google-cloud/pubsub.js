module.exports = (options) => pubsub;

const pubsub = {
  topic: () => topic,
};

const topic = {
  exists: () => Promise.resolve([true]),
  create: () => Promise.resolve(),
  createSubscription: (topic, cb) => cb(null, subscription),
  publisher: () => publisher,
};

const publisher = {
  publish: () => Promise.resolve(),
};

const subscription = {
  close: () => {},
  on: () => {},
};
