// Response class
var extend = require('extend');
var Message = require('./message');
var L = require('./logger').forFile(__filename);

var Response = function(con, msg) {
  var self = this;
  self.con = con;

  extend(true, self, msg);
}

Response.prototype = Object.create(Message.prototype);

Response.prototype.serialize = function() {
  var self = this
  L.debug("Serializing message");
  var err = self.validate();
  if (err)
    throw err;

  var uri = '*';
  if (self.uri)
    uri = self.uri.toString();

  var raw = [self.response, self.status, self.seq].join(" ") + "\r\n";

  for (k in self.headers) {
    raw += k + ": " + self.headers[k] + "\r\n";
  }

  if (typeof self.body !== 'undefined' && self.body !== null)
    raw += "\r\n" + JSON.stringify(self.body);

  return raw;
};

Response.prototype.validate = function() {
  var self = this;
  // Sanitize message
  if (typeof self.headers === 'undefined') {
    self.headers = {};
  }
  if (typeof self.body === 'undefined') {
    self.body = null;
  }
  // Sanity check of message
  if (self.type !== Message.RESPONSE) {
    return Error("This response is no response!");
  }
  if (typeof(self.response) !== "string" || Message.RESPONSES.indexOf(self.response) < 0) {
    return Error("Unknown response" + self.response);
  }
  if (typeof(self.status) !== "number" || self.status <= 0) {
    return Error("Unknown response status: " + self.status);
  }
  if (typeof self.seq !== 'number' || self.seq <= 0) {
    return Error("Missing request sequence number: " + self.seq);
  }
  if (typeof(self.headers) !== 'object') {
    return Error("Invalid headers object: " + self.headers);
  }
  return null;
};

Response.prototype.short = function() {
    return this.response + ' ' + this.status + ' ' + this.seq;
};

module.exports = Response;
