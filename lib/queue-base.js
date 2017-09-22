
module.exports.QueueBase = class QueueBase {
  /**
   *
   * @param options:
   *   [topicBase] = leading name of queue topic
   *   [log] = logger to use
   *   [defaultSubscribeOptions] (see subscribe method)
   */
  setOptions(options) {
    options = options || {};
    this.topicBase = options.topicBase || '';
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
   * @param listener [Function(message|data)] handler for message.
   *   listener should return promise, true, or undefined to ack message (unless autoAck = false)
   * @param options [optional]:
   *    raw [boolean] - provide full message to listener. Default = false (just the data)
   *    autoAck [boolean] - automatically acknowledges message on return from listener. Default = true
   */
  subscribe(topic, listener, options) {
  }

  /**
   * Subscribe for one message
   * @param topic
   * @param options [optional]
   * @returns {Promise.<message>}
   */
  subscribeOne(topic, options) {
  }
};
