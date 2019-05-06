const publish = jest.fn().mockReturnValue('published');
const msg = {
  id: 1,
  data: Buffer.from(JSON.stringify({ msg: 'yay' })),
  ack: jest.fn(),
  nack: jest.fn(),
};
const subscription = {
  on: jest.fn().mockImplementation((ev, handler) => ev === 'message' ? handler({ ...msg }) : null),
  delete: jest.fn().mockReturnValue({}),
};
const mock = {
  get: jest.fn().mockResolvedValue([{ publish }]),
  subscription: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue([subscription]),
  }),
};

class PubSub {
  topic(topicName) {
    return mock;
  }
  get subscribe() {
    return mock.subscription;
  }
  get publish() {
    return publish;
  }
  get subscription() {
    return subscription;
  }
  get msg() {
    return msg;
  }
}

module.exports = {
  PubSub,
};
