class PubSub {
  constructor() {
    this.messages = {};
    this.lastUID = -1;
  }
  /**
   * Utility function that check if an object has a key
   * @param  {Object}  obj Object to be checked
   * @return {Boolean}     Boolean indicating wether passed object has the key
   */
  hasKeys = (obj) => (
    Object.keys(obj)
      .map((key) => (
        Object.prototype.hasOwnProperty.call(obj, key)
      ))[0]
    || false
  )

  throwException = (ex) => () => { throw ex; }

  subscriberDelayedExceptions = (subscriber, message, data) => {
    try {
      subscriber(message, data);
    } catch (ex) {
      setTimeout(this.throwException(ex), 0);
    }
  }

  subscriberImmediateExceptions = (subscriber, message, data) => (
    subscriber(message, data)
  )

  deliverMessage = (message, matchedMessage, data, immediateEx) => {
    const subscribers = this.messages[matchedMessage];
    const callSubscriber = (
      immediateEx
      ? this.subscriberImmediateExceptions
      : this.subscriberDelayedExceptions
    );

    if (!this.messages[matchedMessage]) return;

    Object.keys(subscribers).forEach((subscriber) => (
      subscribers[subscriber]
      && callSubscriber(subscribers[subscriber], message, data)
    ));
  }

  initiateDeliver = (message, data, immediateEx) => () => {
    let topic = String(message);
    let position = topic.lastIndexOf('.');

    /* Deliver subscription in its current state */
    this.deliverMessage(message, message, data, immediateEx);

    /* Trim the hierarchy and deliver subscription to each level */
    while (position !== -1) {
      topic = topic.substr(0, position);
      position = topic.lastIndexOf('.');
      this.deliverMessage(message, topic, data, immediateEx);
    }

    this.deliverMessage(message, 'CATCH_ALL', data, immediateEx);
  }

  messageHasSubscribers = (message) => {
    let topic = String(message);
    let position = topic.lastIndexOf('.');
    let found = Boolean(
      this.messages[topic]
      && this.hasKeys(this.messages[topic]),
    );

    while (!found && position !== -1) {
      topic = topic.substr(0, position);
      position = topic.lastIndexOf('.');
      found = Boolean(
        this.messages[topic]
        && this.hasKeys(this.messages[topic]),
      );
    }

    if (!found) {
      found = Boolean(
        this.messages.CATCH_ALL
        && this.hasKeys(this.messages.CATCH_ALL),
      );
    }
    return found;
  }

  /**
   * PubSub publisher, publishs the passed in message and its data
   * @param  {Oject|String}  message     Type of message being published
   * @param  {Object}        data        Data being published
   * @param  {Object}        immediateEx Exception object to be thrown if fail
   * @return {Boolean}                   Boolean if published
   */
  publish = (message, data, immediateEx) => {
    const deliver = this.initiateDeliver(message, data, immediateEx);
    const hasSubscribers = this.messageHasSubscribers(message);

    if (!hasSubscribers) return false;

    deliver();
    return true;
  }

  /**
   * PubSub publisher async, publishs the passed in message and its data
   * @param  {Oject|String}  message     Type of message being published
   * @param  {Object}        data        Data being published
   * @param  {Object}        immediateEx Exception object to be thrown if fail
   * @return {Boolean}                   Boolean if published
   */
  publishAsync = (message, data, immediateEx) => {
    const deliver = this.initiateDeliver(message, data, immediateEx);
    const hasSubscribers = this.messageHasSubscribers(message);

    if (!hasSubscribers) return false;

    setTimeout(deliver, 0);
    return true;
  }

  /**
   * PubSub subscriber, subscribs the passed in message type and takes a cb
   * @param  {Oject|String}  message     Type of message being subscribed
   * @param  {Function}      cb          Callback once the data is received
   * @return {String}                    Token of the subscribed PubSub
   */
  subscribe = (message, cb) => {
    if (typeof cb !== 'function') return false;
    if (!this.messages[message]) this.messages[message] = {};

    const token = `uid-${String(++this.lastUID)}`; // eslint-disable-line
    this.messages[message][token] = cb;
    return token;
  }

  subscribeAll = (cb) => {
    if (typeof cb !== 'function') return false;
    if (!this.messages.CATCH_ALL) this.messages.CATCH_ALL = {};

    const token = `uid-${String(++this.lastUID)}`; //eslint-disable-line
    this.messages.CATCH_ALL[token] = cb;
    return token;
  }

  clearSubscriptions = (topic) => {
    this.messages.forEach((message) => (
      this.messages[message]
      && message.indexOf(topic) === 0
      && delete this.messages[message]
    ));
  }

  clearAllSubscriptions = () => (this.messages = {});

  unsubscribe = (value) => {
    const descendantTopicExists = (topic) => (
      this.messages.some((message) => (
        this.messages[message] && message.indexOf(topic) === 0
      ))
    );

    const isTopic = (
      typeof value === 'string'
      && (this.messages[value] || descendantTopicExists(value))
    );
    const isToken = !isTopic && typeof value === 'string';
    const isFunction = typeof value === 'function';

    let result = false;
    let message;

    if (isTopic) return this.clearSubscriptions(value);

    this.messages.forEach((m) => {
      if (this.messages[m]) {
        message = this.messages[m];
      }

      if (isToken && message[value]) {
        delete message[value];
        result = value;
      }

      if (isFunction) {
        message.forEach((topic) => {
          if (message[topic] && message[topic] === value) {
            delete message[topic];
            result = true;
          }
        });
      }
    });
    return result;
  }
}

export default new PubSub();
