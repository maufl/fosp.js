// fosp client object protoype
(function(){
var buildModule = function(events, WebSocket, Message, Connection) {
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

  return Client
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = buildModule(require('events'), require('websocket'), require('./message'), require('./connection'));
}
else if (typeof define === 'function' && define.amd) {
  define(['events','./message','./connection'], function(events, Message, Connection) {
    return buildModule(events, WebSocket, Message, Connection);
  })
}
})();
