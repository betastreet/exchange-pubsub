const { PubSub } = require('@google-cloud/pubsub');
const { defaultsDeep, isBoolean, isObjectLike, isFunction } = require('lodash');

/** @type QueuePubSub */
class QueuePubSub {
  static get MAX_NACK_DELAY () {
    return 600;
  }

  /**
   * @param {*} [options]
   * @param {*|boolean} [options.log]
   * @param {*} [options.defaultSubscribeOptions]
   * @param {*} [options.pubSub]
   * @param {boolean} [options.ignoreKeyFilename]
   */
  constructor(options) {
    this.setOptions(options);
  }

  /**
   * pubSubClient
   * NOTE: Must create a new class rather than using the same one for multiple subscriptions
   *       to avoid running into maxStream limits (doesn't seem to be needed for publishing though)
   * https://github.com/googleapis/nodejs-pubsub/issues/550
   */
  get pubSubClient() {
    return new PubSub(this.options.pubSub);
  }

  setOptions(options) {
    options = defaultsDeep(options, {
      log: console,
      ignoreKeyFilename: false,
      autoCreate: true,
      pubSub: {
        projectId: process.env.GCLOUD_PROJECT,
      },
      defaultSubscribeOptions: {
        raw: false,
        autoAck: true,
        subNameWithTopic: true,
        nackDelay: 120,
        pubSub: {
          ackDeadline: 10,
          flowControl: {
            maxMessages: 50,
          },
          maxRetries: 10,
        }
      },
    });
    options.defaultSubscribeOptions.nackDelay = Math.min(options.defaultSubscribeOptions.nackDelay, QueuePubSub.MAX_NACK_DELAY);
    this.log = options.log || { trace: () => {}, warn: () => {}, error: () => {}, log: () => {} };
    if (!options.ignoreKeyFilename && process.env.NODE_ENV === 'development' && !process.env.PUBSUB_EMULATOR_HOST) {
      options.pubSub.keyFilename = options.pubSub.keyFilename || 'lib/gcloud-auth.json';
    }

    this.options = options;
    this.pubsub = new PubSub(this.options.pubSub);
  }

  /**
   * Publish message to topic
   * @param {string} topicName
   * @param {*} msg
   * @returns {Promise<string>} messageId
   */
  publish(topicName, msg) {
    this.log.trace(`publishing ${topicName}: `, msg);
    return this.createTopic(topicName)
      .then(topic => topic.publish(this.objStream(msg)))
      .catch(e => {
        this.log.error(e, `publish error on ${topicName}`, msg);
        throw e;
      });
  }

  /**
   * Subscribe to a topicName
   * @callback subListener. Called with pubSubClient message.data (or msg if options.raw === true)
   *  if !options.autoAck, will never ack/nack a message.
   *  else message will be automatically acknowledged if subListener resolves promise with anything but false
   *  else message will be automatically nack'd if subListener throws an error (or rejection)
   * @param {string} topicName
   * @param {string|boolean|*} [name] if true, then assign random name, false = topicName
   * @param {*} [options]
   * @param {subListener} listener
   * @returns {Promise<Subscription>}
   */
  subscribe(topicName, name, options, listener) {
    if (isBoolean(name)) {
      name = name ? `${topicName}-${(+ new Date() * Math.random()).toString(36).substring(7)}` : topicName;
    } else if (isObjectLike(name)) {
      listener = options;
      options = name;
      name = topicName;
    } else if (isFunction(name)) {
      listener = name;
      name = topicName;
      options = null;
    }
    if (isFunction(options)) {
      listener = options;
      options = null;
    }
    const subOptions = defaultsDeep({ ...options }, this.options.defaultSubscribeOptions);
    if (subOptions.subNameWithTopic && name !== topicName) {
      name = `${name}-${topicName}`;
    }

    this.log.trace(`subscribing to ${topicName}`);
    const onMessage = this.onMessage(topicName, listener, subOptions);
    const createSubscription = () => this.pubSubClient.topic(topicName).subscription(name, subOptions.pubSub).get({ autoCreate: true });
    return Promise.resolve()
      .then(() => createSubscription())
      .then(([subscription]) => {
        subscription.on('message', msg => onMessage(msg));
        subscription.on('error', err => {
          this.log.warn(`subscription error ${topicName}`, err);
          // this.deleteSubscription(subscription)
          //   .then(() => this.subscribe(topicName, name, options, listener))
          //   .then(newSub => Object.assign(subscription, newSub));
        });
        return subscription;
      })
      .catch(e => {
        this.log.error(e, `subscribe error ${topicName}`);
        throw e;
      });
  }

  /**
   * Subscribe to topicName for a single message
   * @param {string} topicName
   * @param {string|boolean|*} [name] if true, then assign random name, false = topicName
   * @param {*} [options]
   * @returns {Promise<*>}
   */
  subscribeOne(topicName, name, options) {
    let msg;
    let subscription;
    return new Promise((resolve, reject) => {
      this.subscribe(topicName, name, options, (message) => {
        if (subscription) {
          resolve(message);
        } else {
          msg = message;
        }
      })
        .then((sub) => {
          subscription = sub;
          if (msg) {
            resolve(msg);
          }
        })
        .catch(e => reject(e));
    })
      .then(msg => {
        return this.deleteSubscription(subscription)
          .then(() => msg)
      });
  }

  /**
   * Creates a topic (if not already created)
   * @param {string} topicName
   * @returns {Promise<Topic>}
   */
  createTopic(topicName) {
    return this.pubsub
      .topic(topicName)
      .get({ autoCreate: this.options.autoCreate })
      .then(([topic]) => topic);
  }

  /**
   * Deletes a subscription
   * @param subscription
   * @returns {Promise<*>}
   */
  deleteSubscription(subscription) {
    return Promise.resolve()
      .then(() => subscription.delete())
      .catch(err => this.log.warn('subscription delete error', err));
  }

  /**
   * Convert source to a Buffer. Stringifies objects first
   * @param {*} obj
   * @return {Buffer2}
   */
  objStream(obj) {
    let content;
    try {
      content = typeof obj === 'string' ? obj : JSON.stringify(obj || {});
    } catch (e) {
      this.log.warn('obj stream error', {obj, e: e.message});
      content = obj;
    }
    return Buffer.from(content);
  }

  /**
   * Message Handler
   * @param {string} topicName
   * @param {Function} listener
   * @param {*} options
   * @return {Function}
   */
  onMessage(topicName, listener, options) {
    return (message) => {
      try {
        message.data = message.data.toString();
        message.data = JSON.parse(message.data);
      } catch(e) {}
      this.log.trace(`message ${message.id} received on ${topicName}`, message.data);
      const ack = () => {
        this.log.trace(`ack ${message.id} ${topicName}`);
        message.ack();
      };
      const nack = () => {
        this.log.trace(`nack ${message.id} ${topicName}`);
        message.nack(options.nackDelay);
      };
      const handlerTimeout = options.autoAck ? setTimeout(() => {
        this.log.warn(`Handler TIMEOUT: message ${message.id} ${topicName}`);
        nack();
      }, (Math.min(options.pubSub.ackDeadline || 10, QueuePubSub.MAX_NACK_DELAY) + 20) * 1000) : 0;

      Promise.resolve()
        .then(() => listener(options.raw === true ? message : message.data))
        .catch(e => {
          this.log.error(e, `listener error on ${topicName}`);
          return false;
        })
        .then(res => {
          clearTimeout(handlerTimeout);
          if (options.autoAck === false) {
            // message ack/nak must be handled by the subscriber
          } else if (res === false) {
            nack();
          } else {
            ack();
          }
        });
    };
  }
}

module.exports.QueuePubSub = QueuePubSub;
