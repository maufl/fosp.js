// Helper methods for Connections
var fosp = require('../fosp');
var helpers = {};

// Convinience for sending requests
helpers.sendRequest = function(request, uri, seq, headers, body) {
  if (typeof headers === 'undefined')
    headers = {}
  if (typeof body === 'undefined')
    body = null
  var msg = { type: fosp.REQUEST, request: request, uri: uri, seq: seq, headers: headers, body: body };
  this.sendMessage(msg);
}
helpers.sendConnect = function(seq, headers, body) {
  this.sendRequest('CONNECT', '*', seq, headers, body)
}
helpers.sendAuthenticate = function(seq, headers, body) {
  this.sendRequest('AUTHENTICATE', '*', seq, headers, body)
}
helpers.sendRegister = function(seq, headers, body) {
  this.sendRequest('REGISTER', '*', seq, headers, body)
}
helpers.sendSelect = function(uri, seq, headers, body) {
  this.sendRequest('SELECT', uri, seq, headers, body)
}
helpers.sendCreate = function(uri, seq, headers, body) {
  this.sendRequest('CREATE', uri, seq, headers, body)
}
helpers.sendUpdate = function(uri, seq, headers, body) {
  this.sendRequest('UPDATE', uri, seq, headers, body)
}
helpers.sendDelete = function(uri, seq, headers, body) {
  this.sendRequest('DELETE', uri, seq, headers, body)
}
helpers.sendList = function(uri, seq, headers, body) {
  this.sendRequest('LIST', uri, seq, headers, body)
}

// Convinience for responses
helpers.sendResponse = function(response, status, seq, headers, body) {
  if (typeof headers === 'undefined')
    headers = {}
  if (typeof body === 'undefined')
    body = null
  var msg = { type: fosp.RESPONSE, response: response, status: status, seq: seq, headers: headers, body: body };
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
  var msg = { type: fosp.NOTIFICATION, event: event, uri: uri, seq: seq, headers: headers, body: body };
  this.sendMessage(msg);
}
// TODO

module.exports = helpers
