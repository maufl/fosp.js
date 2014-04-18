// fosp client object protoype
(function(){
var buildModule = function(events, WebSocket, Message, Connection) {
  var Client = function(options) {
    var self = this;
    if (typeof options !== 'object' || options === null)
      options = {}
    self.port = options.port || 1337;
    self.host = options.host || 'localhost.localdomain';
    self.scheme = options.scheme || "wss";
    self.con = null

    // Work around different websocket apis
    if (typeof WebSocket.client === 'function') {
      var wsc = new WebSocket.client()
      wsc.connect(self.scheme + '://' + self.host + ':' + self.port);
      wsc.on('connect', function(connection) {
        self.con = new Connection(connection);
        self.emit('connect')
      })
    }
    else {
      ws = new WebSocket(self.scheme + '://' + self.host + ':' + self.port);
      ws.onopen = function() {
        self.con = new Connection(ws);
        self.emit('connect')
      }
    }
  };
  Client.prototype = Object.create(events.EventEmitter.prototype);

  return Client
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = buildModule(require('events'), require('websocket'), require('./message'), require('./connection'));
}
else if (typeof define === 'function' && define.amd) {
  define(['EventEmitter','./message','./connection'], function(EventEmitter, Message, Connection) {
    return buildModule({EventEmitter : EventEmitter}, WebSocket, Message, Connection);
  })
}
})();
