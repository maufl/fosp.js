// middleware that routes a request to a remote domain
var util = require('util');
var WebSocket = require('ws');
var Middleware = require('./middleware');
var Connection = require('./connection');

var RemoteDomainRouter = function(server) {
  this.server = server;
}

RemoteDomainRouter.prototype = Object.create(Middleware.prototype);

RemoteDomainRouter.prototype.handleRequest = function(req) {
  if (req.uri !== null && req.uri.user.domain !== this.server.local_domain) {
    // TODO here is the routing going to happen
    log('routing request to correct domain');
    log(req.short());
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
    log('Found existing connection to ' + domain);
    callback(null, con);
  }
  else {
    log('Did not find a existing connection to ' + domain);
    try {
      log('Open new connection to ' + domain);
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
        log('Error occured when connecting to remote domain: ' + err);
      });
    }
    catch (e) {
      log('Error when opening a new connection: ' + e);
      callback(e);
    }
  }
}

var log = function(text) {
  console.log('fosp/mw-remote-domain-route: ' + text);
}

module.exports = RemoteDomainRouter;
