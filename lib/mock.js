const subscriptions = {};

module.exports = {
  options: {},
  pubSubClient: () => ({}),
  setOptions: o => this.options = o,
  publish: () => Promise.resolve(),
  subscribe: subscribeMock,
  subscribeOne: subscribeMock,
  createTopic: () => Promise.resolve(),
  deleteSubscription: () => Promise.resolve(),
  subscriptions,
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
