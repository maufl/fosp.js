// Request class
var Message = require('./message');
var Response = require('./response');
var L = require('./logger').forFile(__filename);

var Request = function(con, msg) {
  Message.call(this,con,msg)
  this.timeoutHandle = null;
}

Request.prototype = Object.create(Message.prototype);

Request.prototype.timeout = 15000;

Request.prototype.serialize = function() {
  L.debug("Serializing request");
  this.validate();

  var uri = this.uri ? this.uri.toString() : '*';

  return  [this.request, uri, this.seq].join(" ") + "\r\n"
          + this.serializeHeaders()
          + this.serializeBody();
};

Request.prototype.validate = function() {
  // Sanity check of message
  if (this.type !== Message.REQUEST) {
    throw new Error("This request is no request!");
  }
  if (typeof(this.request) !== "string" || Message.REQUESTS.indexOf(this.request) < 0) {
    throw new Error("Unknown request: " + this.request);
  }
  if (typeof this.uri !== "object") {
    throw new Error("Invalid request uri: " + this.uri);
  }
  if (typeof this.seq !== 'number' || this.seq <= 0) {
    throw new Error("Missing request sequence number: " + this.seq);
  }
  if (typeof(this.headers) !== 'object') {
    throw new Error("Invalid headers object: " + this.headers);
  }
};

Request.prototype.sendResponse = function(response, status, headers, body) {
  var msg = new Response(this.con, { type: Message.RESPONSE, response: response, status: status, seq: this.seq, headers: headers, body: body });
  return this.con.sendMessage(msg);
}
Request.prototype.sendSucceded = function(status, headers, body) {
  return this.sendResponse('SUCCEDED', status, headers, body)
}
Request.prototype.sendFailed = function(status, headers, body) {
  return this.sendResponse('FAILED', status, headers, body)
}

Request.prototype.short = function() {
  var str = this.request + ' ';
  str += this.uri ? this.uri.toString() : '*';
  str += ' ' + this.seq;
  return str;
};

module.exports = Request;
