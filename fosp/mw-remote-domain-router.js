// middleware that routes a request to a remote domain
var util = require('util');
var Middleware = require('./middleware')

var RemoteDomainRouter = function(server) {
  this.server = server;
}

RemoteDomainRouter.prototype = Object.create(Middleware.prototype);

RemoteDomainRouter.prototype.handleRequest = function(req) {
  if (req.uri !== null && req.uri.user.domain !== this.server.local_domain) {
    // TODO here is the routing going to happen
    log('routing request to correct domain');
    log(req.short());
    return false;
  }
  return true;
}

RemoteDomainRouter.prototype.defaultHandler = function(msg) {
  if (msg.uri !== null && msg.uri.user.domain !== this.server.local_domain)
    return false;
  return true;
}

var log = function(text) {
  console.log('fosp/mw-remote-domain-route: ' + text);
}

module.exports = RemoteDomainRouter;
