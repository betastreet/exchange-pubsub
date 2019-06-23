const { QueuePubSub } = require('./queue-pubsub');
const { PubSub } = require('@google-cloud/pubsub');

describe('QueuePubSub', () => {
  const debug = () => pubSub.log = console;

  const pubsubDefault = {
    ackDeadline: 10,
    flowControl: { maxMessages: 50 },
    maxRetries: 10,
  };
  const queuePubSubDefaults = {
    raw: false,
    autoAck: true,
    subNameWithTopic: true,
    nackDelay: 10,
    pubSub: pubsubDefault,
  };

  let pubSub;
  let mock;
  let msg;
  let listener;
  beforeEach(() => {
    const logMock = () => {};
    pubSub = new QueuePubSub({
      log: {trace: logMock, error: logMock, warn: logMock},
    });
    mock = new PubSub();
    jest.spyOn(PubSub.prototype, 'topic');
    Object.defineProperty(pubSub, 'prop', {
      get: jest.fn(() => mock),
    });
    msg = null;
    listener = rx => msg = rx;
  });

  describe('constructor', () => {
    test('should save options', () => {
      pubSub = new QueuePubSub({
        log: 'hi',
        defaultSubscribeOptions: {hi: 'there'},
      });
      expect(pubSub.log).toBe('hi');
      expect(pubSub.options.defaultSubscribeOptions).toEqual({
        ...queuePubSubDefaults,
        hi: 'there',
      });
    });

    test('should set defaults', () => {
      pubSub = new QueuePubSub();
      expect(pubSub.log).toBe(console);
      expect(pubSub.options.defaultSubscribeOptions).toEqual({
        ...queuePubSubDefaults,
      });
    });

    test('should set keyFileName for dev mode', () => {
      const env = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      pubSub = new QueuePubSub();
      process.env.NODE_ENV = env;
      expect(pubSub.options.pubSub.keyFilename).toBe('lib/gcloud-auth.json');
    });

    test('should allow PUBSUB_EMULATOR_HOST', () => {
      const env = process.env.PUBSUB_EMULATOR_HOST;
      process.env.PUBSUB_EMULATOR_HOST = true;
      pubSub = new QueuePubSub();
      process.env.PUBSUB_EMULATOR_HOST = env;
      expect(pubSub.options.pubSub.keyFilename).not.toBeDefined();
    });

    test('should allow log === false', () => {
      pubSub = new QueuePubSub({log: false});
      expect(pubSub.log).toEqual({
        trace: expect.any(Function),
        warn: expect.any(Function),
        error: expect.any(Function),
        log: expect.any(Function),
      });
      ['trace', 'warn', 'error', 'log'].forEach(method => expect(() => pubSub.log[method]()).not.toThrow());
    });
  });

  describe('publish', () => {
    test('should get the topic', async () => {
      expect(await pubSub.publish('fun times', {})).toBe('published');
      expect(mock.topic).toHaveBeenCalledWith('fun times');
    });

    test('should publish the object', async () => {
      const obj = {hi: 'mom'};
      await pubSub.publish('x', obj);
      expect(mock.publish).toHaveBeenCalledWith(Buffer.from(JSON.stringify(obj)));
    });

    test('should publish strings', async () => {
      await pubSub.publish('x', 'hey!');
      expect(mock.publish).toHaveBeenCalledWith(Buffer.from('hey!'));
    });

    test('should handle empty messages', async () => {
      await pubSub.publish('x');
      expect(mock.publish).toHaveBeenCalledTimes(1);
    });

    test('should make best effort with bad obj', async () => {
      const a = { foo: 1 };
      const b = { bar: 2, a };
      a.b = b;
      expect(await pubSub.publish('x', a).catch(() => 'sorry')).toBe('sorry');
    })

    // test('should return errors', async () => {
    //   publish.and.returnValue(Promise.reject('sorry'));
    //   return expect(pubSub.publish('')).rejects.toEqual('sorry');
    // });
  });

  describe('subscribe', () => {
    // test('should return subscribe error', () => {
    //   expect.assertions(1);
    //   spyOn(mockTopic, 'createSubscription').and.callFake(() => {throw new Error('sorry');});
    //   return pubSub.subscribe('', 'sub', () => {})
    //     .then(() => console.log('here'))
    //     .catch(e => {
    //       expect(e.message).toBe('sorry')
    //     });
    // });

    test('should create random subscription name', async () => {
      await pubSub.subscribe('abc', true, listener);
      expect(mock.subscribe).toHaveBeenCalledWith(
        expect.stringMatching(/abc-.{3,7}-abc/),
        pubsubDefault
      );
    });

    test('should not create random subscription name', async () => {
      await pubSub.subscribe('abc', false, listener);
      expect(mock.subscribe).toHaveBeenCalledWith(
        'abc',
        pubsubDefault
      );
    });

    test('should handle 2 arguments', async () => {
      await pubSub.subscribe('abc', listener);
      expect(mock.subscription.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(msg).toEqual({ msg: 'yay' });
    });

    test('should handle options argument', async () => {
      const options = { hi: 'Paully', maxRetries: 2 };
      await pubSub.subscribe('topic', { raw: true, pubSub: options }, listener);
      expect(msg).toMatchObject({ id: 1, data: { msg: 'yay' } });
      expect(mock.subscribe).toHaveBeenCalledWith('topic', { ...pubsubDefault, ...options });
    });

    test('should handle options argument with subscription name', async () => {
      const options = { hi: 'Paully', maxRetries: 2 };
      await pubSub.subscribe('topic', 'sub', { raw: true, pubSub: options }, listener);
      expect(msg).toMatchObject({ id: 1, data: { msg: 'yay' } });
      expect(mock.subscribe).toHaveBeenCalledWith('sub-topic', { ...pubsubDefault, ...options });
    });

    describe('on events', () => {
      test('should listen to error events', async () => {
        await pubSub.subscribe('topic', listener);
        expect(mock.subscription.on).toHaveBeenCalledWith('error', expect.any(Function));
      });

      test('should call my handler with the data', async () => {
        await pubSub.subscribe('topic', listener);
        expect(msg).toEqual({ msg: 'yay' });
      });

      test('should call my handler with the message if options.raw', async () => {
        await pubSub.subscribe('topic', { raw: true }, listener);
        expect(msg).toMatchObject({ id: 1, data: { msg: 'yay' } });
      });

      test('should ack after my handler', async () => {
        let msgResolver;
        const msgHandler = new Promise(r => msgResolver = r);
        await pubSub.subscribe('topic', () => {
          expect(mock.msg.ack).not.toHaveBeenCalled();
          setTimeout(msgResolver, 3);
          return Promise.resolve();
        });
        await msgHandler;
        expect(mock.msg.ack).toHaveBeenCalledTimes(1);
        expect(mock.msg.nack).not.toHaveBeenCalled();
      });

      test('should nack if returning false', async () => {
        let msgResolver;
        const msgHandler = new Promise(r => msgResolver = r);
        await pubSub.subscribe('topic', () => {
          expect(mock.msg.nack).not.toHaveBeenCalled();
          setTimeout(msgResolver, 3);
          return false;
        });
        await msgHandler;
        expect(mock.msg.nack).toHaveBeenCalledTimes(1);
        expect(mock.msg.ack).not.toHaveBeenCalled();
      });

      test('should nack if throwing an exception', async () => {
        let msgResolver;
        const msgHandler = new Promise(r => msgResolver = r);
        await pubSub.subscribe('topic', () => {
          setTimeout(msgResolver, 3);
          throw new Error('hi');
        });
        await msgHandler;
        expect(mock.msg.nack).toHaveBeenCalledTimes(1);
        expect(mock.msg.ack).not.toHaveBeenCalled();
      });

      test('should do nothing if autoAck is false', async () => {
        let msgResolver;
        const msgHandler = new Promise(r => msgResolver = r);
        await pubSub.subscribe('topic', { autoAck: false }, () => {
          setTimeout(msgResolver, 3);
        });
        await msgHandler;
        expect(mock.msg.nack).not.toHaveBeenCalled();
        expect(mock.msg.ack).not.toHaveBeenCalled();
      });
    });
  });

  describe('subscribeOne', () => {
    test('should subscribe and close when done', async () => {
      expect(await pubSub.subscribeOne('monkey')).toEqual({ msg: 'yay' });
      expect(mock.msg.ack).toHaveBeenCalledTimes(1);
      expect(mock.subscription.delete).toHaveBeenCalledTimes(1);
    });

    // test('should reject on error', async () => {
    //   expect(await pubSub.subscribeOne('monkey')).toEqual({ msg: 'yay' });
    //   expect(mock.msg.ack).toHaveBeenCalledTimes(1);
    //   expect(mock.subscription.delete).toHaveBeenCalledTimes(1);
    // });
  });

  describe('deleteSubscription', () => {
    let subscription;
    beforeEach(() => subscription = { delete: jest.fn().mockResolvedValue('done') });

    test('should call close on subscription', async () => {
      await pubSub.deleteSubscription(subscription);
      expect(subscription.delete).toHaveBeenCalledTimes(1);
    });

    test('should handle errors', async () => {
      expect(await pubSub.deleteSubscription().catch(() => 'um')).not.toBeDefined();
    });
  });
});
