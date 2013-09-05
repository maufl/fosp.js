// middleware that routes a request to a remote domain
var util = require('util');
var extend = require('extend');
var WebSocket = require('websocket');
var Middleware = require('../middleware');
var Connection = require('../connection');
var L = require('../../logger').forFile(__filename);

var RemoteDomainRouter = function(server) {
  this.server = server;
}

RemoteDomainRouter.prototype = Object.create(Middleware.prototype);

RemoteDomainRouter.prototype.handleRequest = function(req) {
  if (req.uri !== null && req.uri.user.domain !== this.server.local_domain) {
    if (req.con.type === 'server') {
      L.warn('We got an request from server of domain ' + req.con.remote + ' for resource ' + req.uri.toString() + ' not on our domain, this is bad!')
      req.sendFailed(422, {}, 'This server is not an authority for the resource')
      return false
    }
    // TODO here is the routing going to happen
    L.info('Routing request to correct domain: ' + req.short());
    this.server.connectionPool.getOrCreateOne(req.uri.user.domain, function(err, con) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, 'Error while opening a connection to remote domain: ' + err);
      else
        con.sendRequest(req.request, req.uri.toString(), extend(true, req.headers, { User: req.con.remote }), req.body).on('response', function(resp) {
          req.sendResponse(resp.response,resp.status, resp.headers, resp.body);
        }).on('timeout', function() {
          req.sendFailed(504);
        });
    });
    return false;
  }
  return true;
}

RemoteDomainRouter.prototype.defaultHandler = function(msg) {
  if (msg.uri !== null && msg.uri.user.domain !== this.server.local_domain)
    return false;
  return true;
}

module.exports = RemoteDomainRouter;
