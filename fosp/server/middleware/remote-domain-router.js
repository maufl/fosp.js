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
    // TODO here is the routing going to happen
    L.info('Routing request to correct domain: ' + req.short());
    this.withConnection(req.uri.user.domain, function(err, con) {
      if (err)
        req.sendFailed(502, {}, err.toString());
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

RemoteDomainRouter.prototype.withConnection = function(domain, callback) {
  var self = this;
  var con = self.server.connectionPool.get(domain);
  if (typeof con === 'object' && con !== null) {
    L.info('Found existing connection to ' + domain);
    callback(null, con);
  }
  else {
    L.info('Did not find a existing connection to ' + domain);
    try {
      L.info('Open new connection to ' + domain);
      var newWs = new WebSocket.client()
      newWs.connect('ws://'+domain+':'+self.server.port);
      newWs.on('connect', function(con) {
        var newCon = new Connection(con);
        self.server.connectionPool.push(newCon);
        newCon.sendConnect({}, {version: '0.1'}).on('succeded', function() {
          newCon.sendAuthenticate({}, {type: 'server', domain: self.server.local_domain}).on('succeded', function() {
            callback(null, newCon);
          }).on('failed', function() {
            callback(new Error('Could not authenticate with remote domain'), null);
          });
        }).on('failed', function() {
          callback(new Error('Could not negotiate with remote domain'), null);
        });
      });
      newWs.on('error', function(err) {
        L.warn('Error occured when connecting to remote domain: ' + err);
      });
    }
    catch (e) {
      L.error('Error when opening a new connection: ' + e);
      callback(e);
    }
  }
}

module.exports = RemoteDomainRouter;
