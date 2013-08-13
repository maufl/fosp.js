// Basic fosp server function
var events = require('events')
var WebSocket = require('ws');
var fosp = require('../fosp')
var Connection = require('./connection')

var Server = function(options) {
  var self = this;
  var port = options.port || 1337;
  self.wss = new WebSocket.Server({ port: port });

  self.wss.on('connection', function(ws) {
    var con = new Connection(ws);
    self.emit('connection', con);

    var eventIdentifiers = ['message', 'request', 'response', 'notification',
      'select', 'create', 'update', 'delete', 'list',
      'succeded', 'failed',
      'created', 'updated', 'deleted'
    ]
    /*
    for (eventId in eventIdentifiers) {
      con.on(eventId, function(msg) {
        log('Recieved event: ' + eventId);
        self.emit(eventId, con, msg);
      });
    }
    */
    con.on('message', function(msg) {
      self.emit('message', con, msg);
    });
    con.on('request', function(msg) {
      self.emit('request', con, msg);
    });
    con.on('response', function(msg) {
      self.emit('response', con, msg);
    });
    con.on('notification', function(msg) {
      self.emit('notification', con, msg);
    });
  });
};
Server.prototype = Object.create(events.EventEmitter.prototype);

var log = function(text) {
  console.log('fosp/server: ' + text);
}

module.exports = Server;
