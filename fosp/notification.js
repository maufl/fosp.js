// Notification class
var extend = require('extend');
var Message = require('./message');
var L = require('./logger').forFile(__filename);

var Notification = function(con, msg) {
  var self = this;
  self.con = con;

  extend(true, self, msg);
}

Notification.prototype = Object.create(Message.prototype);

Notification.prototype.serialize = function() {
  var self = this
  L.debug("Serializing message");
  var err = self.validate();
  if (err)
    throw err;

  var uri = '*';
  if (self.uri)
    uri = self.uri.toString();

  var raw = [self.event, uri].join(" ") + "\r\n";

  for (k in self.headers) {
    raw += k + ": " + self.headers[k] + "\r\n";
  }

  if (typeof self.body !== 'undefined' && self.body !== null)
    raw += "\r\n" + JSON.stringify(self.body);

  return raw;
};


Notification.prototype.validate = function() {
  var self = this;
  // Sanitize message
  if (typeof self.headers === 'undefined') {
    self.headers = {};
  }
  if (typeof self.body === 'undefined') {
    self.body = null;
  }
  // Sanity check of message
  if ( self.type !== Message.NOTIFICATION) {
    return Error("This notification is no notification");
  }
  if (typeof(self.event) !== "string" || Message.EVENTS.indexOf(self.event) < 0) {
    return Error("Unknown event: " + self.event);
  }
  if (typeof self.uri !== "object") {
    return Error("Invalid request uri: " + self.uri);
  }
  if (typeof(self.headers) !== 'object') {
    return Error("Invalid headers object: " + self.headers);
  }
  return null;
};


Notification.prototype.short = function() {
  return this.event + ' ' + this.uri.toString();
};

module.exports = Notification;
