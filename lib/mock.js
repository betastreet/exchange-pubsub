const subscriptions = {};

module.exports = {
  setOptions: () => {},
  publish: () => Promise.resolve(),
  subscribe: subscribeMock,
  subscribeOne: subscribeMock,
  subscriptions: subscriptions,
};

function subscribeMock(topic, name, options, listener) {
  if (typeof name === 'function') {
    listener = name;
    name = undefined;
  } else if (typeof options === 'function') {
    listener = options;
    options = undefined;
  }
  subscriptions[topic] = {
    topic,
    name,
    options,
    listener,
  };
  return Promise.resolve();
}
