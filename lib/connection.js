// This object type models a fosp connection
(function(){
var buildModule = function(events, URI, Message, Request, Parser, L) {
  var Connection = function(ws) {
    var self = this;
    self.ws = ws;
    self.id = Math.floor(Math.random() * 10001);
    self.currentSeq = 1;
    self.pendingRequests = {};

    var emitMessage = function(message) {
      try {
        var data = message.binaryData || message.utf8Data || message.data;
        var msg = Parser.parseMessage(self, data);
        L.debug('Recieved new message: ' + msg.toString());
        self.emit('message', msg);
      }
      catch(e) {
        L.error(e.stack);
      }
    }

    if (typeof self.ws.on === 'function') {
      self.ws.on('message', function(message) { emitMessage(message); });
      self.ws.on('close', function() { self.emit('close'); });
      self.ws.on('error', function(err) { self.emit('error',err); });
    }
    else {
      self.ws.onmessage = function(message) { emitMessage(message); }
      self.ws.onclose = function() { self.emit('close'); }
      self.ws.onerror = function(err) { self.emit('error',err); }
    }

    self.on('message', function(msg) {
      switch(msg.type) {
        case Message.REQUEST:
          self.emit('request', msg);
          break;
        case Message.RESPONSE:
          self.emit('response', msg);
          break;
        case Message.NOTIFICATION:
          self.emit('notification', msg);
          break;
        default:
          L.warn('Recieved unknow type of message: ' + msg.type)
          break;
      }
    });

    self.on('response', function(msg) {
      var req = self.pendingRequests[msg.seq];
      delete self.pendingRequests[msg.seq];
      var existsRequest = false;
      if (typeof req !== 'undefined' && req instanceof Request) {
        try { clearTimeout(req.timeoutHandle); }
        catch (e) {}
        existsRequest = true;
        req.emit('response', msg)
      }
      switch(msg.response) {
        case 'SUCCEDED':
          if (existsRequest)
            req.emit('succeded', msg);
          self.emit('succeded', msg);
          break;
        case 'FAILED':
          if (existsRequest)
            req.emit('failed', msg);
          self.emit('failed', msg);
          break;
        default:
          L.warn('Recieved unknown response: ' + msg.response)
          break;
      }
    });

    self.on('notification', function(msg) {
      switch(msg.event) {
        case 'CREATED':
          self.emit('created', msg)
          break
        case 'UPDATED':
          self.emit('updated', msg)
          break
        case 'DELETED':
          self.emit('deleted', msg)
          break
        default:
          L.warn('Recieved unknown notification: ' + msg.event)
          break
      }
    })
  };

  Connection.prototype = Object.create(events.EventEmitter.prototype);

  Connection.prototype.sendMessage = function(msg) {
    var self = this;
    L.debug('Sending ' + Message.TYPES[msg.type])
    try {
      var raw = msg.serialize();
      L.debug("Send message: " + msg.toString());
      this.ws.send(raw);
      if (msg instanceof Request) {
        msg.timeoutHandle = setTimeout(function(){
          msg.emit('timeout');
        }, msg.timeout);
        msg.on('timeout', function() {
          delete self.pendingRequests[msg.seq];
        });
      }
    }
    catch(e) {
      L.error(e.stack);
    }
    return msg;
  }

  Connection.prototype.close = function() {
    this.ws.close();
  }

  // Convinience for sending requests
  Connection.prototype.sendRequest = function(request, uri, headers, body) {
    var self = this;
    L.debug('Building request')
    if (typeof uri === 'string')
      uri = new URI(uri);
    var msg = new Request(self, { type: Message.REQUEST, request: request, uri: uri, seq: self.currentSeq, headers: headers, body: body });
    self.currentSeq++;
    self.pendingRequests[msg.seq] = msg;
    return self.sendMessage(msg);
  }
  Connection.prototype.sendConnect = function(headers, body) {
    return this.sendRequest('CONNECT', null, headers, body)
  }
  Connection.prototype.sendAuthenticate = function(headers, body) {
    return this.sendRequest('AUTHENTICATE', null, headers, body)
  }
  Connection.prototype.sendRegister = function(headers, body) {
    return this.sendRequest('REGISTER', null, headers, body)
  }
  Connection.prototype.sendSelect = function(uri, headers, body) {
    return this.sendRequest('SELECT', uri, headers, body)
  }
  Connection.prototype.sendCreate = function(uri, headers, body) {
    return this.sendRequest('CREATE', uri, headers, body)
  }
  Connection.prototype.sendUpdate = function(uri, headers, body) {
    return this.sendRequest('UPDATE', uri, headers, body)
  }
  Connection.prototype.sendDelete = function(uri, headers, body) {
    return this.sendRequest('DELETE', uri, headers, body)
  }
  Connection.prototype.sendList = function(uri, headers, body) {
    return this.sendRequest('LIST', uri, headers, body)
  }
  Connection.prototype.sendRead = function(uri, headers, body) {
    return this.sendRequest('READ', uri, headers, body)
  }
  Connection.prototype.sendWrite = function(uri, headers, body) {
    return this.sendRequest('WRITE', uri, headers, body)
  }

  return Connection;
}
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = buildModule(require('events'),
        require('./uri'),
        require('./message'),
        require('./request'),
        require('./parser'),
        require('./logger').forFile(__filename));
}
else if (typeof define === 'function' && define.amd) {
  define(['EventEmitter', './uri', './message', './request', './parser', './logger'], function(EventEmitter, URI, Message, Request, Parser, logger) {
    return buildModule({EventEmitter: EventEmitter}, URI, Message, Request, Parser, logger.forFile('fosp/connection'));
  })
}
})();
