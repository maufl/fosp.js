// Helper methods for Connections
var Message = require('./message');
var URI = require('./uri');
var helpers = {};

// Convinience for sending requests
helpers.sendRequest = function(request, uri, headers, body) {
  var self = this;
  if (typeof uri === 'string')
    uri = new URI(uri);
  var msg = new Message(self, { type: Message.REQUEST, request: request, uri: uri, seq: self.currentSeq, headers: headers, body: body });
  self.currentSeq++;
  self.sendMessage(msg);
}
helpers.sendConnect = function(headers, body) {
  this.sendRequest('CONNECT', null, headers, body)
}
helpers.sendAuthenticate = function(headers, body) {
  this.sendRequest('AUTHENTICATE', null, headers, body)
}
helpers.sendRegister = function(headers, body) {
  this.sendRequest('REGISTER', null, headers, body)
}
helpers.sendSelect = function(uri, headers, body) {
  this.sendRequest('SELECT', uri, headers, body)
}
helpers.sendCreate = function(uri, headers, body) {
  this.sendRequest('CREATE', uri, headers, body)
}
helpers.sendUpdate = function(uri, headers, body) {
  this.sendRequest('UPDATE', uri, headers, body)
}
helpers.sendDelete = function(uri, headers, body) {
  this.sendRequest('DELETE', uri, headers, body)
}
helpers.sendList = function(uri, headers, body) {
  this.sendRequest('LIST', uri, headers, body)
}

// Convinience for responses
helpers.sendResponse = function(response, status, seq, headers, body) {
  if (typeof headers === 'undefined')
    headers = {}
  if (typeof body === 'undefined')
    body = null
  var msg = { type: Message.RESPONSE, response: response, status: status, seq: seq, headers: headers, body: body };
  this.sendMessage(msg);
}
helpers.sendSucceded = function(status, seq, headers, body) {
  this.sendResponse('SUCCEDED', status, seq, headers, body)
}
helpers.sendFailed = function(status, seq, headers, body) {
  this.sendResponse('FAILED', status, seq, headers, body)
}

// Convinience for notifications, not really need atm
helpers.sendNotification = function(event, uri, seq, headers, body) {
  if (typeof headers === 'undefined')
    headers = {}
  if (typeof body === 'undefined')
    body = null
  var msg = { type: Message.NOTIFICATION, event: event, uri: uri, seq: seq, headers: headers, body: body };
  this.sendMessage(msg);
}
// TODO

module.exports = helpers
