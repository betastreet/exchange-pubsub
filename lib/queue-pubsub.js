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
    if (!options.ignoreKeyFilename && process.env.NODE_ENV === 'development') {
      options.pubSub.keyFilename = options.pubSub.keyFilename || 'lib/gcloud-auth.json';
    }

    this.pubSubClient = pubSub((options || {}).pubSub);
  }

  publish(topic, obj) {
    topic = this.fullTopic(topic);
    this.log.trace('publishing', {topic, obj});
    const pubSubTopic = this.pubSubClient.topic(topic);
    const publisher = pubSubTopic.publisher();
    return publisher.publish(this.objStream(obj))
      .catch(e => {
        this.log.error(e, 'publish error');
        throw e;
      });
  }

  subscribe(topic, listener, options) {
    topic = this.fullTopic(topic);
    options = options || this.defaultSubscribeOptions;
    this.log.trace(`subscribing to ${topic}`);
    return this.createTopic(topic)
      .then((pubSubTopic) => pubSubTopic.createSubscription(topic, (err, subscription) => {
        if (err) throw err;

        subscription.on('error', (err) => this.log.error('subscribe error', err));
        subscription.on('message', (msg) => this.onMessage(topic, listener, options)(msg));

        return subscription;
      })).catch(e => {
          this.log.error(e, 'subscribe error');
          throw e;
      });
  }

  subscribeOne(topic, options) {
    return new Promise(resolve => {
      this.subscribe(topic, (message) => resolve(message), options)
        .then(subscription => this.closeSubscription(subscription));
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

  fullTopic(topic) {
    return (this.topicBase ? `${this.topicBase}${topic}` : topic).toLowerCase();
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

  onMessage(topic, listener, options) {
    return (message) => {
      this.log.trace('message received', {topic, message});
      const outputArg = (options.raw === true) ? message : message.data;
      Promise.resolve()
        .then(listener(outputArg))
        .catch(e => this.log.error('listener error', e))
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