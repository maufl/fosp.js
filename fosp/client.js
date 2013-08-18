// fosp client object protoype
var events = require('events');
var WebSocket = require('websocket');
var Message = require('./message');
var Connection = require('./connection');

var Client = function(options) {
  var self = this;
  if (typeof options !== 'object' || options === null)
    options = {}
  self.port = options.port || 1337;
  self.host = options.host || 'localhost.localdomain';
  self.con = null

  self.wsc = new WebSocket.client()
  self.wsc.connect('ws://' + self.host + ':' + self.port);
  self.wsc.on('connect', function(connection) {
    self.con = new Connection(connection);
    self.emit('connect')
  })
};
Client.prototype = Object.create(events.EventEmitter.prototype);

module.exports = Client;
