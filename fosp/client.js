// fosp client object protoype
var events = require('events');
var WebSocket = require('ws');
var Message = require('./message');
var Connection = require('./connection');

var Client = function(options) {
  var self = this;
  if (typeof options !== 'object' || options === null)
    options = {}
  self.port = options.port || 1337;
  self.host = options.host || 'localhost';

  self.wsc = new WebSocket('ws://' + self.host + ':' + self.port);
  self.con = new Connection(self.wsc);

  self.wsc.on('open', function() {
    self.emit('open');
  });
  self.wsc.on('error', function(msg) {
    self.emit('error', msg);
  });
  self.wsc.on('close', function() {
    self.emit('close')
  });
};
Client.prototype = Object.create(events.EventEmitter.prototype);

var log = function(text) {
  console.log('fosp/client: ' + text);
}

module.exports = Client;
