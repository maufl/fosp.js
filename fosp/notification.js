// Notification class
var Message = require('./message');
var L = require('./logger').forFile(__filename);

var Notification = function(con, msg) {
  Message.call(this, con, msg)
}

Notification.prototype = Object.create(Message.prototype);

Notification.prototype.serialize = function() {
  L.debug("Serializing message");
  this.validate();

  return [this.event, this.uri.toString()].join(" ") + "\r\n"
          + this.serializeHeaders()
          + this.serializeBody();
};


Notification.prototype.validate = function() {
  // Sanity check of message
  if ( this.type !== Message.NOTIFICATION) {
    throw new Error("This notification is no notification");
  }
  if (typeof(this.event) !== "string" || Message.EVENTS.indexOf(this.event) < 0) {
    throw new Error("Unknown event: " + this.event);
  }
  if (typeof this.uri !== "object") {
    throw new Error("Invalid request uri: " + this.uri);
  }
  if (typeof(this.headers) !== 'object') {
    throw new Error("Invalid headers object: " + this.headers);
  }
};


Notification.prototype.short = function() {
  return this.event + ' ' + this.uri.toString();
};

module.exports = Notification;
