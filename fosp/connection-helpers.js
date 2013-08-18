// Helper methods for Connections
var Message = require('./message');
var Request = require('./request');
var Response = require('./response');
var Notification = require('./notification');
var URI = require('./uri');
var helpers = {};

// Convinience for sending requests
helpers.sendRequest = function(request, uri, headers, body) {
  var self = this;
  if (typeof uri === 'string')
    uri = new URI(uri);
  var msg = new Request(self, { type: Message.REQUEST, request: request, uri: uri, seq: self.currentSeq, headers: headers, body: body });
  self.currentSeq++;
  self.pendingRequests[msg.seq] = msg;
  return self.sendMessage(msg);
}
helpers.sendConnect = function(headers, body) {
  return this.sendRequest('CONNECT', null, headers, body)
}
helpers.sendAuthenticate = function(headers, body) {
  return this.sendRequest('AUTHENTICATE', null, headers, body)
}
helpers.sendRegister = function(headers, body) {
  return this.sendRequest('REGISTER', null, headers, body)
}
helpers.sendSelect = function(uri, headers, body) {
  return this.sendRequest('SELECT', uri, headers, body)
}
helpers.sendCreate = function(uri, headers, body) {
  return this.sendRequest('CREATE', uri, headers, body)
}
helpers.sendUpdate = function(uri, headers, body) {
  return this.sendRequest('UPDATE', uri, headers, body)
}
helpers.sendDelete = function(uri, headers, body) {
  return this.sendRequest('DELETE', uri, headers, body)
}
helpers.sendList = function(uri, headers, body) {
  return this.sendRequest('LIST', uri, headers, body)
}

// Convinience for notifications, not really need atm
helpers.sendNotification = function(event, uri, headers, body) {
  if (typeof headers === 'undefined')
    headers = {}
  if (typeof body === 'undefined')
    body = null
  if (typeof uri === 'string')
    uri = new URI(uri);
  var msg = new Notification(this, { type: Message.NOTIFICATION, event: event, uri: uri, headers: headers, body: body });
  return this.sendMessage(msg);
}

helpers.sendCreated = function(uri, headers, body) {
  return this.sendNotification('CREATED', uri, headers, body);
}
helpers.sendUpdated = function(uri, headers, body) {
  return this.sendNotification('UPDATED', uri, headers, body);
}
helpers.sendDeleted = function(uri, headers, body) {
  return this.sendNotification('DELETED', uri, headers, body);
}

module.exports = helpers
