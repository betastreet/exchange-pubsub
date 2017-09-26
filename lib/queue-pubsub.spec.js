const { QueuePubSub } = require('./queue-pubsub');
const mock = require('@google-cloud/pubsub')();

describe('QueuePubSub', () => {
  let pubSub;
  let mockTopic;
  beforeEach(() => {
    const logMock = () => {};
    pubSub = new QueuePubSub({
      log: {trace: logMock, error: logMock, warn: logMock},
    });
    mockTopic = mock.topic();
  });

  describe('constructor', () => {
    it('should save options', () => {
      pubSub = new QueuePubSub({
        log: 'hi',
        defaultSubscribeOptions: 'def',
      });
      expect(pubSub.log).toBe('hi');
      expect(pubSub.defaultSubscribeOptions).toBe('def');
    });

    it('should set defaults', () => {
      pubSub = new QueuePubSub();
      expect(pubSub.log).toBe(console);
      expect(pubSub.defaultSubscribeOptions).toEqual({
        raw: false,
        autoAck: true,
      });
    });

    it('should set keyFileName for dev mode', () => {
      const env = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      pubSub = new QueuePubSub();
      process.env.NODE_ENV = env;
      expect(pubSub.pubSubClient.options.keyFilename).toBe('lib/gcloud-auth.json');
    });
  });

  describe('publish', () => {
    let bufferFrom;
    let publish;
    beforeEach(() => bufferFrom = spyOn(Buffer, 'from').and.callFake(a => a));
    beforeEach(() => {
      publish = spyOn(mockTopic.publisher(), 'publish').and.callThrough();
    });

    it('should get the topic', () => {
      const topic = spyOn(mock, 'topic').and.callThrough();
      return pubSub.publish('fun times', {})
        .then(() => expect(topic).toHaveBeenCalledWith('fun times'));
    });

    it('should publish the object', () => {
      const obj = {hi: 'mom'};
      return pubSub.publish('x', obj)
        .then(() => expect(bufferFrom).toHaveBeenCalledWith(JSON.stringify(obj)))
        .then(() => expect(publish).toHaveBeenCalledWith(JSON.stringify(obj)));
    });

    it('should publish strings', () => {
      return pubSub.publish('x', 'hey!')
        .then(() => expect(publish).toHaveBeenCalledWith('hey!'));
    });

    it('should handle empty messages', () => {
      return pubSub.publish('x')
        .then(() => expect(publish).toHaveBeenCalledTimes(1));
    });

    it('should return errors', () => {
      publish.and.returnValue(Promise.reject('sorry'));
      return expect(pubSub.publish('')).rejects.toEqual('sorry');
    });
  });

  describe('subscribe', () => {
    let mockSub;
    beforeEach(() => {
      mockSub = {};
      mockTopic.createSubscription('', null, (err, sub) => mockSub = sub);
    });

    describe('when creating topic', () => {
      let exists, create;
      beforeEach(() => {
        exists = spyOn(mockTopic, 'exists').and.callThrough();
        create = spyOn(mockTopic, 'create').and.callThrough();
      });

      it('should not create if exists', () => {
        const topic = spyOn(mock, 'topic').and.callThrough();
        return pubSub.subscribe('eyes', 'sub', () => {})
          .then(() => {
            expect(topic).toHaveBeenCalledWith('eyes');
            expect(exists).toHaveBeenCalledTimes(1);
            expect(create).not.toHaveBeenCalled();
          });
      });

      it('should create if not exists', () => {
        exists.and.returnValue(Promise.resolve([false]));
        return pubSub.subscribe('eyes', 'sub', () => {})
          .then(() => {
            expect(exists).toHaveBeenCalledTimes(1);
            expect(create).toHaveBeenCalledTimes(1);
          });
      });
    });

    it('should create Subscription', () => {
      const createSubscription = spyOn(mockTopic, 'createSubscription').and.callThrough();
      return pubSub.subscribe('abc', 'sub', () => {})
        .then(() => expect(createSubscription).toHaveBeenCalledWith('sub', undefined, jasmine.any(Function)));
    });

    it('should return subscribe error', () => {
      const createSubscription = spyOn(mockTopic, 'createSubscription').and.returnValue(Promise.reject(new Error('sorry')));
      return pubSub.subscribe('', 'sub', () => {})
        .catch(e => expect(e.message).toBe('sorry'));
    });

    it('should create random subscription name', () => {
      spyOn(mockTopic, 'createSubscription').and.callThrough();
      return pubSub.subscribe('abc', true, () => {})
        .then(() => expect(mockTopic.createSubscription).toHaveBeenCalledWith(jasmine.stringMatching(/^abc-.{8,}/), undefined, jasmine.any(Function)));
    });

    it('should not create random subscription name', () => {
      spyOn(mockTopic, 'createSubscription').and.callThrough();
      return pubSub.subscribe('abc', false, () => {})
        .then(() => expect(mockTopic.createSubscription).toHaveBeenCalledWith('abc', undefined, jasmine.any(Function)));
    });

    it('should handle 2 arguments', () => {
      spyOn(mockTopic, 'createSubscription').and.callThrough();
      return pubSub.subscribe('abc', () => {})
        .then(() => expect(mockTopic.createSubscription).toHaveBeenCalledWith('abc', undefined, jasmine.any(Function)));
    });

    it('should handle options argument', () => {
      spyOn(mockTopic, 'createSubscription').and.callThrough();
      const options = {hi: 'Paully'};
      return pubSub.subscribe('topic', {pubSub: options}, () => {})
        .then(() => expect(mockTopic.createSubscription).toHaveBeenCalledWith('topic', options, jasmine.any(Function)));
    });

    it('should handle options argument with subscription name', () => {
      spyOn(mockTopic, 'createSubscription').and.callThrough();
      const options = {hi: 'Paully'};
      return pubSub.subscribe('topic', 'please', {pubSub: options}, () => {})
        .then(() => expect(mockTopic.createSubscription).toHaveBeenCalledWith('please', options, jasmine.any(Function)));
    });

    describe('on events', () => {
      let subOn, listeners, message;
      let myHandler;
      beforeEach(() => {
        listeners = {};
        subOn = spyOn(mockSub, 'on').and.callFake((sub, handler) => listeners[sub] = handler);
        myHandler = jasmine.createSpy();
        message = {
          data: 'loud and clear!',
          ack: jasmine.createSpy(),
          nack: jasmine.createSpy(),
        };
        return pubSub.subscribe('', 'sub', myHandler);
      });

      describe('error', () => {
        it('should listen to error events', () => {
          expect(subOn).toHaveBeenCalledWith('error', jasmine.any(Function));
        });
      });

      describe('message', () => {
        it('should listen to message events', () => {
          expect(subOn).toHaveBeenCalledWith('message', jasmine.any(Function));
        });

        it('should call my handler with the data', (done) => {
          listeners.message(message);
          setImmediate(() => {
            expect(myHandler).toHaveBeenCalledWith(message.data);
            done();
          });
        });

        it('should call my handler with the message if options.raw', () => {
          return pubSub.subscribe('', 'sub', {raw: true}, myHandler)
            .then(() => listeners.message(message))
            .then(() => expect(myHandler).toHaveBeenCalledWith(message));
        });

        it('should ack after my handler', (done) => {
          listeners.message(message);
          setImmediate(() => {
            expect(message.ack).toHaveBeenCalled();
            expect(message.nack).not.toHaveBeenCalled();
            done();
          });
        });

        it('should ack after my handler resolves', (done) => {
          let resolver;
          myHandler.and.returnValue(new Promise(resolve => resolver = resolve));
          listeners.message(message);
          setImmediate(() => {
            expect(message.ack).not.toHaveBeenCalled();
            resolver();
            setImmediate(() => {
              expect(message.ack).toHaveBeenCalled();
              done();
            });
          });
        });

        it('should nack if returning false', (done) => {
          myHandler.and.returnValue(false);
          listeners.message(message);
          setImmediate(() => {
            expect(message.nack).toHaveBeenCalled();
            expect(message.ack).not.toHaveBeenCalled();
            done();
          });
        });

        it('should nack if throwing an exception', (done) => {
          myHandler.and.callFake(() => {throw new Error('uh oh')});
          listeners.message(message);
          setImmediate(() => {
            expect(message.nack).toHaveBeenCalled();
            expect(message.ack).not.toHaveBeenCalled();
            done();
          });
        });

        it('should do nothing if autoAck is false', () => {
          return pubSub.subscribe('', 'sub', myHandler, {autoAck: false})
            .then(() => listeners.message(message))
            .then(() => {
              expect(message.nack).not.toHaveBeenCalled();
              expect(message.ack).not.toHaveBeenCalled();
            });
        });
      });
    });
  });

  describe('subscribeOne', () => {
    let mockSub, subOn, listeners, message;
    beforeEach(() => {
      mockSub = {};
      mockTopic.createSubscription('', null, (err, sub) => mockSub = sub);
      listeners = {};
      subOn = spyOn(mockSub, 'on').and.callFake((sub, handler) => listeners[sub] = handler);
      message = {
        data: 'ooh ooh',
        ack: jasmine.createSpy(),
        nack: jasmine.createSpy(),
      };
    });

    it('should subscribe and close when done', (done) => {
      spyOn(pubSub, 'closeSubscription');
      const promise = pubSub.subscribeOne('monkey', 'sub');
      setImmediate(() => {
        listeners.message(message);
        expect(promise).resolves.toEqual('ooh ooh');
        expect(pubSub.closeSubscription).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });

  describe('closeSubscription', () => {
    it('should call close on subscription', () => {
      const sub = {
        close: jasmine.createSpy()
      };
      pubSub.closeSubscription(sub);
      expect(sub.close).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', () => {
      const sub = {
        close: jasmine.createSpy().and.callFake((cb) => cb('uh oh')),
      };
      pubSub.closeSubscription(sub);
      expect(sub.close).toHaveBeenCalledTimes(1);
    })
  });
});
