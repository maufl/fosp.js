// Everything message related

/* Message format
 * REQUEST := REQUEST_TYPE + " " + RESOURCE_IDENTIFIER + " " + SEQUENCE_NUMBER\r\n
 *            HEADERS\r\n
 *            \r\n
 *            BODY
 * REQUEST_TYPE := CONNECT || AUTHENTICATE || REGISTER || CREATE || UPDATE || DELETE || SELECT
 *
 * RESPONSE := RESPONSE_TYPE + " " + RESONSE_STATUS + " " SEQUENCE_NUMBER\r\n
 *             HEADERS\r\n
 *             \r\n
 *             BODY
 * RESPONSE_TYPE := SUCCEDED || FAILED
 *
 * NOTIFICATION := EVENT_TYPE + " " + RESOURCE_IDENTIFIER\r\n
 *                 HEADERS\r\n
 *                 \r\n
 *                 BODY
 * EVENT_TYPE := CREATED || UPDATED || DELETED
 *
 * RESOURCE_IDENTIFIER := USERNAME + "@" + DOMAIN + PATH
 * USERNAME := [a-z][a-z0-9_\-.]*
 * DOMAIN := DOMAIN_PART ( + "." + DOMAIN_PART)*
 * DOMAIN_PART := [a-z][a-z0-9_\-+]*
 * PATH := (/ + PATH_FRAGMENT)*
 * PATH_FRAGMENT := [a-z][a-z0-9\-_+]*
 *
 * HEADERS := "" || (HEADER\r\n
 *                  HEADERS)
 * HEADER  := HEADER_KEY + ": " + HEADER_VALUE
 * HEADER_KEY := [A-Z] + [a-zA-Z\-_]*
 * HEADER_VALUE := [A-Z] + [a-zA-Z\-_/]*
 */
var extend = require('extend');
var sys = require('sys');
var URI = require('./uri');

var REQUESTS = ["CONNECT", "AUTHENTICATE", "REGISTER", "CREATE", "UPDATE", "DELETE", "SELECT", "LIST"];
var RESPONSES = ["SUCCEDED", "FAILED"];
var EVENTS = ["CREATED", "UPDATED", "DELETED"];
var REQUEST = 1;
var RESPONSE = 2;
var NOTIFICATION = 3;

// Message serialization and parsing
var _parseMessage = function(raw) {
  log('Parsing message');
  var message = {type: null, seq: null, request: null, response: null, event: null, uri: null, status: null, headers: {}, body: null};
  var lines = raw.split("\r\n");
  var main_line = lines.shift();
  var main = main_line.split(" ");

  // Identify the typ of the message
  var identifier = main[0];
  log('Identifier is ' + identifier);
  if (REQUESTS.indexOf(identifier) >= 0) {
    message.type = REQUEST;
    message.request = identifier;
  } else if (RESPONSES.indexOf(identifier) >= 0) {
    message.type = RESPONSE;
    message.response = identifier;
  } else if (EVENTS.indexOf(identifier) >= 0) {
    message.type = NOTIFICATION;
    message.event = identifier;
  } else {
    throw new Error("Type of message unknown: " + identifier);
  }

  // Read the URI
  if ((message.type == REQUEST || message.type == NOTIFICATION) && main.length >= 2) {
    if (message.type == REQUEST && ['CONNECT', 'REGISTER', 'AUTHENTICATE'].indexOf(message.request) < 0) {
      message.uri = new URI(main[1]);
    }
    else {
      message.uri = null;
    }
  }

  // Read the status code
  if (message.type == RESPONSE && main.length >= 2) {
    message.status = main[1];
  }

  // Read sequence number
  if ((message.type == REQUEST || message.type == RESPONSE) && main.length == 3) {
    if (typeof main[2] === 'string')
      message.seq = parseInt(main[2], 10);
    else
      message.seq = main[2];
  }

  // Read headers
  var tmp = lines.shift();
  while (typeof(tmp) === "string" && tmp != "") {
    var header = tmp.split(": ");
    if (header.length === 2) {
      message.headers[header[0]] = header[1];
    }
    else {
      throw new Error("Bad header format");
    }
    tmp = lines.shift();
  }

  // Read body
  if (lines instanceof Array && lines.length > 0) {
    var body = lines.join("\n");
    try {
      message.body = JSON.parse(body);
    }
    catch(e) {
      message.body = body;
    }
  }

  return message;
};

var _serializeMessage = function(msg) {
  if (! (msg instanceof Message))
    throw new Error('Tried to serialize a non-message!');
  log("Serializing message");
  var err = msg.validate();
  if (err)
    throw err;
  log(msg.short());

  var uri = '*';
  if (msg.uri)
    uri = msg.uri.toString();

  var raw = "";
  if (msg.type === REQUEST)
    raw += [msg.request, uri, msg.seq].join(" ");
  if (msg.type === RESPONSE)
    raw += [msg.response, msg.status, msg.seq].join(" ");
  if (msg.type === NOTIFICATION)
    raw += [msg.event, uri].joint(" ");

  raw += "\r\n";
  for (k in msg.headers) {
    raw += k + ": " + msg.headers[k] + "\r\n";
  }

  if (typeof msg.body !== 'undefined' && msg.body !== null)
    raw += "\r\n" + JSON.stringify(msg.body);

  return raw;
};

// Actuall message class definition

var Message = function(con, msg) {
  var self = this;
  self.con = con;

  if (typeof msg === 'string')
    msg = _parseMessage(msg);
  extend(true, self, msg);
}

Message.REQUESTS = REQUESTS;
Message.RESPONSES = RESPONSES;
Message.EVENTS = EVENTS;
Message.REQUEST = REQUEST;
Message.RESPONSE = RESPONSE;
Message.NOTIFICATION = NOTIFICATION;

Message.prototype.validate = function() {
  var self = this;
  // Sanitize message
  if (typeof self.headers === 'undefined') {
    self.headers = {};
  }
  if (typeof self.body === 'undefined') {
    self.body = null;
  }
  // Sanity check of message
  if (self.type !== REQUEST && self.type !== RESPONSE && self.type !== NOTIFICATION) {
    return Error("Unknown type of message: " + self.type);
  }
  if (self.type === REQUEST) {
    if (typeof(self.request) !== "string" || REQUESTS.indexOf(self.request) < 0) {
      return Error("Unknown request: " + self.request);
    }
  }
  if (self.type === RESPONSE) {
    if (typeof(self.response) !== "string" || RESPONSES.indexOf(self.response) < 0) {
      return Error("Unknown response" + self.response);
    }
    if (typeof(self.status) !== "number" || self.status <= 0) {
      return Error("Unknown response status: " + self.status);
    }
  }
  if (self.type === NOTIFICATION) {
    if (typeof(self.event) !== "string" || EVENTS.indexOf(self.event) < 0) {
      return Error("Unknown event: " + self.event);
    }
  }
  if (self.type === REQUEST || self.type === NOTIFICATION) {
    if (typeof self.uri !== "object") {
      return Error("Invalid request uri: " + self.uri);
    }
  }
  if ((self.type === REQUEST || self.type === RESPONSE) && (typeof self.seq !== 'number' || self.seq <= 0)) {
    return Error("Missing request sequence number: " + self.seq);
  }
  if (typeof(self.headers) !== 'object') {
    return Error("Invalid headers object: " + self.headers);
  }
  return null;
};

Message.prototype.serialize = function() {
  return _serializeMessage(this);
};

Message.prototype.short = function() {
  var self = this;
  var str = '';
  if (self.type === REQUEST) {
    str += self.request + ' ';
    if (self.uri)
      str += self.uri.toString();
    else
      str += '*';
    str += ' ' + self.seq;
  }
  if (self.type === RESPONSE)
    str += self.response + ' ' + self.status + ' ' + self.seq;
  if (self.type === NOTIFICATION)
    str += self.event + ' ' + self.uri.toString();
  return str;
};

Message.prototype.toString = function() {
  return this.short() + ' :: ' + JSON.stringify(this.body);
}

var log = function(text) {
  console.log('fosp/message: ' + text);
};

module.exports = Message;
