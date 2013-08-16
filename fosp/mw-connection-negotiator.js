// middleware that negotiates the connection
var Middleware = require('./middleware')

var ConnectionNegotiator = function(version) {
  this.version = version;
}

ConnectionNegotiator.prototype = Object.create(Middleware.prototype)

ConnectionNegotiator.prototype.handleConnect = function(msg) {
  if (msg.body.version === this.version) {
    msg.sendSucceded(100);
    msg.con.ctx.negotiated = true;
    log('Connection successfully negotiated');
    return true;
  }
  log('Connection negotiation failed');
  msg.sendFailed(500);
  return false;
}

ConnectionNegotiator.prototype.defaultHandler = function(msg) {
  return msg.con.ctx.negotiated;
}

ConnectionNegotiator.prototype.handleRequest = function(msg) {
  if (!msg.con.ctx.negotiated) {
    msg.sendFailed(500);
    return false;
  }
  return true;
}

ConnectionNegotiator.prototype.handleResponse = function(msg) {
  if (!msg.con.ctx.negotiated) {
    msg.con.close();
    return false;
  }
  return true;
}

ConnectionNegotiator.prototype.handleNotification = ConnectionNegotiator.prototype.handleResponse;

var log = function(text) {
  console.log('fosp/connection-negotiator: ' + text);
}

module.exports = ConnectionNegotiator;
