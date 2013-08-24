// Basic fosp server function
var events = require('events')
var http = require('http')
var WebSocket = require('websocket');
var Connection = require('./server/connection')
var ConnectionPool = require('./server/connection-pool')
var ConnectionNegotiator = require('./server/middleware/connection-negotiator');
var ServerAuthenticator = require('./server/middleware/dns-server-authenticator')
var L = require('./logger').forFile(__filename);

var Server = function(options) {
  var self = this;
  // Set options
  self.port = options.port || 1337;
  self.local_domain = options.local_domain || 'localhost.localdomain';
  self.middlewareStack = [];
  // Bootstrap underlying objects
  self.connectionPool = new ConnectionPool(self);
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
    self.connectionPool.push(con);
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

module.exports = Server;
