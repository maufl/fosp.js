// Basic fosp server function
var events = require('events')
var http = require('http')
var WebSocket = require('websocket');
var Connection = require('./connection')
var ConnectionNegotiator = require('./mw-connection-negotiator');
var ServerAuthenticator = require('./mw-dns-server-authenticator')
var L = require('./logger').forFile(__filename);

var Server = function(options) {
  var self = this;
  // Set options
  self.port = options.port || 1337;
  self.local_domain = options.local_domain || 'localhost.localdomain';
  self.connectionPool = {};
  self.middlewareStack = [];
  // Bootstrap underlying objects
  self.httpServer = new http.createServer(function(request, response) {
    L.info('Received http request for ' + request.url);
    response.writeHead(404);
    response.end();
  });
  self.httpServer.listen(self.port, function() { L.info('Server is listening on port ' + self.port) });

  self.wss = new WebSocket.server({ httpServer: self.httpServer, autoAcceptConnections: true });

  var cn = new ConnectionNegotiator('0.1');
  self.middlewareStack.push(cn);
  var dsa = new ServerAuthenticator();
  self.middlewareStack.push(dsa);

  self.wss.on('connect', function(ws) {
    var con = new Connection(ws);
    self.emit('connect', con);

    var eventIds = ['message', 'request', 'response', 'notification',
      'connect', 'authenticate', 'register', 'select', 'create', 'update', 'delete', 'list',
      'succeded', 'failed',
      'created', 'updated', 'deleted'
    ];

    eventIds.forEach(function(eventId) {
      con.on(eventId, function(msg) {
        var passed = true;
        for (var i=0; i < self.middlewareStack.length; i++) {
          passed = self.middlewareStack[i].handle(eventId, msg);
          if (!passed) {
            L.debug('Middleware chain halted at ' + i)
            break;
          }
        }
        if (passed)
          self.emit(eventId, con, msg);
      });
    });
  });
};
Server.prototype = Object.create(events.EventEmitter.prototype);

Server.prototype.delegateRequest = function(req) {
  var domain = req.uri.domain;
  if (domain === '')
    throw new Error('Tried to delegate to an empty domain');
  if (domain === self.local_domain)
    throw new Error('Tried to delegeta request for own domain');

  if (typeof connectionPool[domain] === 'undefined' || connectionPool[domain] === null) {
    var newWs = new WebSocket('ws://'+domain+':'+self.port);
    var newConnection = new Connection(ws);
    newConnection.on('open', function() {
      newConnection.sendConnect({}, {version:"0.1"});
    });
  }
}

module.exports = Server;
