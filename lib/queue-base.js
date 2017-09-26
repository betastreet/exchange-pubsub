
module.exports.QueueBase = class QueueBase {
  constructor() {
    this.setOptions();
  }

  /**
   *
   * @param options:
   *   [log] = logger to use
   *   [defaultSubscribeOptions] (see subscribe method)
   */
  setOptions(options) {
    options = options || {};
    this.log = options.log || console;
    this.defaultSubscribeOptions = options.defaultSubscribeOptions || {
      raw: false,
      autoAck: true,
    }
  }

  /**
   * Publish a message to a topic
   * @param topic [string] name of topic to publish message to
   * @param obj data to publish
   * @returns {*|Promise}
   */
  publish(topic, obj) {
  }

  /**
   * Subscribes to messages on a topic
   * @param topic [string] name of topic
   * @param name [string] name of subscription
   * @param options [optional]:
   *    raw [boolean] - provide full message to listener. Default = false (just the data)
   *    autoAck [boolean] - automatically acknowledges message on return from listener. Default = true
   * @param listener [Function(message|data)] handler for message.
   *   listener should return promise, true, or undefined to ack message (unless autoAck = false)
   */
  subscribe(topic, name, options, listener) {
  }

  /**
   * Subscribe for one message
   * @param topic
   * @param name
   * @param options [optional]
   * @returns {Promise.<message>}
   */
  subscribeOne(topic, name, options) {
  }
};
