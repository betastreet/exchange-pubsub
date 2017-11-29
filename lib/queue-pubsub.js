const { QueueBase } = require('./queue-base');
const pubSub = require('@google-cloud/pubsub');

class QueuePubSub extends QueueBase {
  /**
   * @param options [optional]
   *  [pubSub] = see @google-cloud/pubsub
   *  [ignoreKeyFilename] = don't set keyFilename
   */
  constructor(options) {
    super();
    this.setOptions(options);
  }

  setOptions(options) {
    options = options || {};
    super.setOptions(options);
    options.pubSub = options.pubSub || {};
    options.pubSub.projectId = options.pubSub.projectId || process.env.GCLOUD_PROJECT;
    if (!options.ignoreKeyFilename && process.env.NODE_ENV === 'development' && !process.env.PUBSUB_EMULATOR_HOST) {
      options.pubSub.keyFilename = options.pubSub.keyFilename || 'lib/gcloud-auth.json';
    }

    this.pubSubClient = pubSub(options.pubSub);
  }

  publish(topic, obj) {
    this.log.trace('publishing', {topic, obj});
    const pubSubTopic = this.pubSubClient.topic(topic);
    const publisher = pubSubTopic.publisher();
    return publisher.publish(this.objStream(obj))
      .catch(e => {
        this.log.error(e, 'publish error');
        throw e;
      });
  }

  subscribe(topic, name, options, listener) {
    if (typeof name === 'boolean') {
      name = name ? `${topic}-${Math.random().toString(36).substring(7)}` : topic;
    } else if (typeof name === 'object') {
      options = name;
      listener = options;
      name = topic;
    } else if (typeof name === 'function') {
      listener = name;
      name = topic;
      options = null;
    }
    if (typeof options === 'function') {
      listener = options;
      options = null;
    }
    options = Object.assign(this.defaultSubscribeOptions, options || {});
    if (options.subNameWithTopic && name !== topic) {
      name = `${name}-${topic}`;
    }

    this.log.trace(`subscribing to ${topic}`);
    return this.createAndSubscribe(topic, name, options, listener);
  }

  subscribeOne(topic, name, options) {
    return new Promise(resolve => {
      this.subscribe(topic, name, options, (message) => resolve(message))
        .then(subscription => this.closeSubscription(subscription));
    });
  }

  createAndSubscribe(topic, name, options, listener) {
    options.subscriber = () => this.createAndSubscribe(topic, name, options, listener);
    return this.createTopic(topic)
      .then((pubSubTopic) => pubSubTopic.createSubscription(name, options.pubSub, (err, subscription) => {
        if (err) throw err;

        this.resetConnectionTimer(options);
        subscription.on('error', (err) => this.onError(err, subscription, options.subscriber));
        subscription.on('message', (msg) => this.onMessage(topic, listener, options)(msg));

        return subscription;
      })).catch(e => {
        this.log.error(e, 'subscribe error');
        throw e;
      });
  }

  createTopic(topic) {
    const pubSubTopic = this.pubSubClient.topic(topic);
    return pubSubTopic.exists()
      .then((data) => data[0] ? null : pubSubTopic.create())
      .then(() => pubSubTopic);
  }

  closeSubscription(subscription) {
    subscription.close(err => {
      this.log.warn('subscription close error', err);
    });
  }

  objStream(obj) {
    let content;
    try {
      content = typeof obj === 'string' ? obj : JSON.stringify(obj || {});
    } catch(e) {
      this.log.warn('obj stream error', {obj, e: e.message});
      content = obj;
    }
    return Buffer.from(content);
  }

  resetConnectionTimer(options) {
    if (options.connectionTimer) {
      clearTimeout(options.connectionTimer);
    }
    if (options.connectionInterval) {
      options.connectionTimer = setTimeout(options.subscriber, options.connectionInterval * 1000);
    }
  }

  onError(error, subscription, subscribe) {
    this.log.warn(error, 'subscribe error');
    this.closeSubscription(subscription);
    subscribe();
  }

  onMessage(topic, listener, options) {
    return (message) => {
      this.resetConnectionTimer(options);

      try { message.data = JSON.parse(message.data = message.data.toString()); } catch(e) {}
      const outputArg = (options.raw === true) ? message : message.data;
      this.log.trace('message received', {topic, message});

      Promise.resolve()
        .then(() => listener(outputArg))
        .catch(e => {
          this.log.error(e, 'listener error');
          return false;
        })
        .then(res => {
          if (options.autoAck === false) {
            // message ack/nak must be handled by the subscriber
          } else if (res === false) {
            message.nack();
          } else {
            message.ack();
          }
        });
    };
  }
}

module.exports.QueuePubSub = QueuePubSub;
