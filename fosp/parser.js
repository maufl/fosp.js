// Message parser
var URI = require('./uri')
var Message = require('./message')
var Request = require('./request')
var Response = require('./response')
var Notification = require('./notification')

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
  if (Message.REQUESTS.indexOf(identifier) >= 0) {
    message.type = Message.REQUEST;
    message.request = identifier;
  } else if (Message.RESPONSES.indexOf(identifier) >= 0) {
    message.type = Message.RESPONSE;
    message.response = identifier;
  } else if (Message.EVENTS.indexOf(identifier) >= 0) {
    message.type = Message.NOTIFICATION;
    message.event = identifier;
  } else {
    throw new Error("Type of message unknown: " + identifier);
  }

  // Read the URI
  if ((message.type == Message.REQUEST || message.type == Message.NOTIFICATION) && main.length >= 2) {
    if (message.type == Message.REQUEST && ['CONNECT', 'REGISTER', 'AUTHENTICATE'].indexOf(message.request) < 0) {
      message.uri = new URI(main[1]);
    }
    else {
      message.uri = null;
    }
  }

  // Read the status code
  if (message.type == Message.RESPONSE && main.length >= 2) {
    message.status = main[1];
  }

  // Read sequence number
  if ((message.type == Message.REQUEST || message.type == Message.RESPONSE) && main.length == 3) {
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

var Parser = function() {
}

Parser.parseMessage = function(con, raw) {
  var msg = _parseMessage(raw);
  if (msg.type === Message.REQUEST)
    return new Request(con, msg);
  if (msg.type === Message.RESPONSE)
    return new Response(con, msg);
  if (msg.type === Message.NOTIFICATION)
    return new Notification(con, msg);

  throw new Error('Something\'s wrong with this message!');
}

var log = function(text) {
  console.log('fosp/parser: ' + text)
}

module.exports = Parser