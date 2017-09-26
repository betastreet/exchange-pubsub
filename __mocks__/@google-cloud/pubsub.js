module.exports = (options) => {
  pubsub.options = options;
  return pubsub;
};

const pubsub = {
  topic: () => topic,
};

const topic = {
  exists: () => Promise.resolve([true]),
  create: () => Promise.resolve(),
  createSubscription: (name, options, cb) => cb(null, subscription),
  publisher: () => publisher,
};

const publisher = {
  publish: () => Promise.resolve(),
};

const subscription = {
  close: () => {},
  on: () => {},
};
