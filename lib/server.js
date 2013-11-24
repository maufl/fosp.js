// Basic fosp server function
var events = require('events')
var http = require('http')
var WebSocket = require('websocket');
var Connection = require('./server/connection')
var ConnectionPool = require('./server/connection-pool')
var RequestHandler = require('./server/request-handler')
var DatabaseAbstractionLayer = require('./server/database-abstraction-layer')
var NotificationListener = require('./server/notification-listener')
var AuthenticatorMiddleware = require('./server/middleware/async-user-authenticator');
var RemoteDomainRouter = require('./server/middleware/remote-domain-router');
var ConnectionNegotiator = require('./server/middleware/connection-negotiator');
var ServerAuthenticator = require('./server/middleware/dns-server-authenticator')
var L = require('./logger').forFile(__filename);

var Server = function(options, dbDriver) {
  var self = this;
  // Set options
  self.port = options.port || 1337;
  self.remote_port = options.remote_port || 1337;
  self.local_domain = options.local_domain || 'localhost.localdomain';
  self.max_received_frame_size = options.maxReceivedFrameSize || 10*1024*1024 // 10MiB
  self.max_received_message_size = options.maxReceivedMessageSize || 10*1024*1024 // 10MiB
  // Bootstrap underlying objects
  self.db = new DatabaseAbstractionLayer(dbDriver)
  self.connectionPool = new ConnectionPool(self);
  self.requestHandler = new RequestHandler(self)
  self.notificationListener = new NotificationListener(self, self.db);

  // initializing middleware
  self.middlewareStack = [];
  var cn = new ConnectionNegotiator('0.1');
  self.middlewareStack.push(cn);
  var dsa = new ServerAuthenticator();
  self.middlewareStack.push(dsa);
  var rdr = new RemoteDomainRouter(self);
  self.middlewareStack.push(rdr);
  // atm authentication is hardcoded into the db driver implementation anyway :/
  var auth = new AuthenticatorMiddleware(function(name, password, callback) {
    self.db.authenticateUser(name, password, function(err) {
      callback(err);
    });
  });
  self.middlewareStack.push(auth);

  // Setting up the actual server
  self.httpServer = new http.createServer(function(request, response) {
    L.info('Received http request for ' + request.url);
    response.writeHead(404);
    response.end();
  });
  self.httpServer.listen(self.port, function() { });

  self.wss = new WebSocket.server({ httpServer: self.httpServer,
                                    autoAcceptConnections: true,
                                    keepalive: false,
                                    maxReceivedFrameSize: self.max_received_frame_size,
                                    maxReceivedMessageSize: self.max_received_message_size });

  L.info('Started server for domain ' + self.local_domain + ' on port ' + self.port)
  self.wss.on('connect', self.registerConnection.bind(self));
};
Server.prototype = Object.create(events.EventEmitter.prototype);

Server.prototype.registerConnection = function(ws) {
    var con = new Connection(ws), self = this
    self.connectionPool.push(con);
    self.emit('connect', con);

    var eventIds = ['message', 'request', 'response', 'notification',
      'connect', 'authenticate', 'register', 'select', 'create', 'update', 'delete', 'list', 'read', 'write',
      'succeeded', 'failed',
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
    return con;
}

module.exports = Server;
