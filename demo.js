const pubSub = require('exchange-pubsub');
// Optional:
pubSub.setOptions({
  log: console,
  defaultSubscribeOptions: {
    raw: false,
    autoAck: true,
  },
});

pubSub.subscribe('myTopic', 'subscription name', (msgData => {
  // default is only the message.data property from pubsub
  console.log(msgData); // should be 'my message' in this example

  // optionally return false or a Promise
  // if return value resolves to false, message will be nack'd, else ack'd
  // (unless autoAck option is disabled)
}));

pubSub.publish('myTopic', 'my message')
  .then(() => {/* do something */ })
  .catch(e => {/* error */ });

// specify subscription name and options:
pubSub.subscribe('myTopic', 'subscription name', {autoAck: false, raw: true}, (msg => {
  console.log(msg.data);
  msg.ack();
}));

// random subscription name
pubSub.subscribe('myTopic', true, (msgData => {
  console.log(msgData);
  return Promise.reject();  // force a nack
}));