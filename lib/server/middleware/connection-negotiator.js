// middleware that negotiates the connection
var Middleware = require('../middleware')
var L = require('../../logger').forFile(__filename);

var ConnectionNegotiator = function(version) {
  this.version = version;
}

ConnectionNegotiator.prototype = Object.create(Middleware.prototype)

ConnectionNegotiator.prototype.handleConnect = function(msg) {
  if (msg.body.version === this.version) {
    msg.sendSucceded(100);
    msg.con.negotiated = true;
    L.info('Connection successfully negotiated');
    return true;
  }
  L.warn('Connection negotiation failed');
  msg.sendFailed(500);
  return false;
}

ConnectionNegotiator.prototype.defaultHandler = function(msg) {
  return msg.con.negotiated;
}

ConnectionNegotiator.prototype.handleRequest = function(msg) {
  if (!msg.con.negotiated) {
    msg.sendFailed(500);
    return false;
  }
  return true;
}

ConnectionNegotiator.prototype.handleResponse = function(msg) {
  if (!msg.con.negotiated) {
    msg.con.close();
    return false;
  }
  return true;
}

ConnectionNegotiator.prototype.handleNotification = ConnectionNegotiator.prototype.handleResponse;

module.exports = ConnectionNegotiator;
