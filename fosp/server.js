// Basic fosp server function
var events = require('events')
var WebSocket = require('ws');
var Connection = require('./connection')

var Server = function(options) {
  var self = this;
  var port = options.port || 1337;
  self.wss = new WebSocket.Server({ port: port });

  self.wss.on('connection', function(ws) {
    var con = new Connection(ws);
    self.emit('connection', con);

    var eventIds = ['message', 'request', 'response', 'notification',
      'connect', 'authenticate', 'register', 'select', 'create', 'update', 'delete', 'list',
      'succeded', 'failed',
      'created', 'updated', 'deleted'
    ].forEach(function(eventId) {
      con.on(eventId, function(msg) {
        self.emit(eventId, con, msg);
      });
    });
  });
};
Server.prototype = Object.create(events.EventEmitter.prototype);

var log = function(text) {
  console.log('fosp/server: ' + text);
}

module.exports = Server;
