// middleware that routes a request to a remote domain
var util = require('util');
var WebSocket = require('ws');
var Middleware = require('./middleware');
var Connection = require('./connection');
var L = require('./logger').forFile(__filename);

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
        req.sendFailed(410, {}, err.toString());
      else
        con.sendRequest(req.request, req.uri.toString(), req.headers, req.body).on('response', function(resp) {
          req.sendResponse(resp.response,resp.status, resp.headers, resp.body);
        }).on('timeout', function() {
          req.sendFailed(450);
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
  var con = self.server.connectionPool[domain];
  if (typeof con === 'object' && con !== null) {
    L.info('Found existing connection to ' + domain);
    callback(null, con);
  }
  else {
    L.info('Did not find a existing connection to ' + domain);
    try {
      L.info('Open new connection to ' + domain);
      var newWs = new WebSocket('ws://'+domain+':'+self.server.port);
      var newCon = new Connection(newWs);
      newCon.on('open', function() {
        newCon.sendConnect({}, {version: '0.1'}).on('succeded', function() {
          newCon.sendAuthenticate({}, {type: 'server', domain: self.server.local_domain}).on('succeded', function() {
            self.server.connectionPool[domain] = newCon;
            callback(null, newCon);
          }).on('failed', function() {
            callback(new Error('Could not authenticate with remote domain'), null);
          });
        }).on('failed', function() {
          callback(new Error('Could not negotiate with remote domain'), null);
        });
      });
      newCon.on('error', function(err) {
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
