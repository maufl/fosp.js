// Request class
var extend = require('extend');
var Message = require('./message');
var Response = require('./response');
var L = require('./logger').forFile(__filename);

var Request = function(con, msg) {
  var self = this;
  self.con = con;
  self.timeoutHandle = null;

  extend(true, self, msg);
}

Request.prototype = Object.create(Message.prototype);

Request.prototype.timeout = 15000;

Request.prototype.serialize = function() {
  var self = this
  L.debug("Serializing request");
  var err = self.validate();
  if (err)
    throw err;

  var uri = '*';
  if (self.uri)
    uri = self.uri.toString();

  var raw = [self.request, uri, self.seq].join(" ") + "\r\n";

  for (k in self.headers) {
    raw += k + ": " + self.headers[k] + "\r\n";
  }

  if (typeof self.body !== 'undefined' && self.body !== null)
    raw += "\r\n" + JSON.stringify(self.body);

  return raw;
};

Request.prototype.validate = function() {
  var self = this;
  // Sanitize message
  if (typeof self.headers === 'undefined') {
    self.headers = {};
  }
  if (typeof self.body === 'undefined') {
    self.body = null;
  }
  // Sanity check of message
  if (self.type !== Message.REQUEST) {
    return Error("This request is no request!");
  }
  if (typeof(self.request) !== "string" || Message.REQUESTS.indexOf(self.request) < 0) {
    return Error("Unknown request: " + self.request);
  }
  if (typeof self.uri !== "object") {
    return Error("Invalid request uri: " + self.uri);
  }
  if (typeof self.seq !== 'number' || self.seq <= 0) {
    return Error("Missing request sequence number: " + self.seq);
  }
  if (typeof(self.headers) !== 'object') {
    return Error("Invalid headers object: " + self.headers);
  }
  return null;
};

Request.prototype.sendResponse = function(response, status, headers, body) {
  var self = this;
  if (typeof headers === 'undefined')
    headers = {}
  if (typeof body === 'undefined')
    body = null
  var msg = new Response(self.con, { type: Message.RESPONSE, response: response, status: status, seq: self.seq, headers: headers, body: body });
  return self.con.sendMessage(msg);
}
Request.prototype.sendSucceded = function(status, headers, body) {
  return this.sendResponse('SUCCEDED', status, headers, body)
}
Request.prototype.sendFailed = function(status, headers, body) {
  return this.sendResponse('FAILED', status, headers, body)
}

Request.prototype.short = function() {
  var self = this;
  var str = '';
  str += self.request + ' ';
  if (self.uri)
    str += self.uri.toString();
  else
    str += '*';
  str += ' ' + self.seq;
  return str;
};

module.exports = Request;
