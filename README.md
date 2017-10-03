[![Version](https://badge.fury.io/js/exchange-pubsub.svg)](http://badge.fury.io/js/exchange-pubsub)
[![Build Status](https://travis-ci.org/betastreet/exchange-pubsub.svg?branch=master)](https://travis-ci.org/betastreet/exchange-pubsub)
 
# exchange-pubsub

A helper module to simplify @google-cloud/pubsub

### Installation

`npm i --save exchange-pubsub`

### Options
 * log = logger to use (defaults to console)
 * defaultSubscribeOptions = (same as optional per-subscription options)
   * raw - provide full message to listener. Default = false (just the data)
   * autoAck - automatically acknowledge messages on return from listener. Default = true
 * ignoreKeyFilename = don't set default pubSub keyFilename option
 * pubSub = see @google-cloud/pubsub
   * projectId will attempt to use process.env.GCLOUD_PROJECT if not set
   * keyFilename will set to 'lib/gcloud-auth.json' if not set and ignoreKeyFilename is not set
 
### Usage

```javascript
const pubSub = require('exchange-pubsub');
// Optional:
pubSub.setOptions({
  log: console,
  defaultSubscribeOptions: {
    raw: false,
    autoAck: true,
  },
});

// simple usage:
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
```

The default usage uses the topic as the subscription name which means
it will be processed by a single subscriber (if multiple subscribers use the same name).

You can also specify the name manually, or have a random name generated:

```javascript
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
```

Source: [demo.js](demo.js)
