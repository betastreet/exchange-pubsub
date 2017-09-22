const pubSub = require('exchange-pubsub');
// Optional:
pubSub.setOptions({
  topicBase: 'myTopicBase',
  log: console,
  defaultSubscribeOptions: {
    raw: false,
    autoAck: true,
  },
});

pubSub.subscribe('myTopic', (msgData => {
  // default is only the message.data property from pubsub
  console.log(msgData); // should be 'my message' in this example

  // optionally return false or a Promise
  // if return value resolves to false, message will be nack'd, else ack'd
  // (unless autoAck option is disabled)
}));

pubSub.publish('myTopic', 'my message')
  .then(() => {/* do something */ })
  .catch(e => {/* error */ });
