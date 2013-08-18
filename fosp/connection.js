// This object type models a fosp connection
var events = require('events')
var extend = require('extend')
var Message = require('./message')
var Request = require('./request')
var Parser = require('./parser')
var helpers = require('./connection-helpers')
var L = require('./logger').forFile(__filename);

var Connection = function(ws) {
  var self = this;
  self.ws = ws;
  self.id = Math.floor(Math.random() * 10001);
  self.currentSeq = 1;
  self.pendingRequests = {};
  
  self.negotiated = false;
  self.authenticated = false;
  self.type = '';
  self.remote = '';

  // Emit message events on new messages, and also more specific events
  self.ws.on('message', function(message) {
    try {
      var msg = Parser.parseMessage(self, message.utf8Data);
      L.debug('Recieved new message: ' + msg.short());
      self.emit('message', msg);
    }
    catch(e) {
      L.error(e.stack);
    }
  });

  self.ws.on('close', function() {
    self.emit('close');
  });

  self.ws.on('error', function(err) {
    self.emit('error',err);
  });

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

  self.on('request', function(msg) {
    switch(msg.request) {
      case 'CONNECT':
        self.emit('connect', msg);
        break;
      case 'REGISTER':
        self.emit('register', msg);
        break;
      case 'AUTHENTICATE':
        self.emit('authenticate', msg);
        break;
      case 'SELECT':
        self.emit('select', msg);
        break;
      case 'CREATE':
        self.emit('create', msg);
        break;
      case 'UPDATE':
        self.emit('update', msg);
        break;
      case 'DELETE':
        self.emit('delete', msg);
        break;
      case 'LIST':
        self.emit('list', msg);
        break;
      default:
        L.warn('Recieved unknown request: ' + msg.request)
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

  // TODO on notification
};

Connection.prototype = Object.create(events.EventEmitter.prototype);

Connection.prototype.sendMessage = function(msg) {
  var self = this;
  try {
    var raw = msg.serialize();
    L.debug("Send message: " + msg.short());
    L.verbose(raw);
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

Connection.prototype.updateContext = function(type, remote) {
  if ((type === 'server' || type === 'client') && typeof remote === 'string') {
    this.type = type
    this.remote = remote
    L.info('Updated connection context to ' + type + ' : ' + remote)
    this.emit('context-updated')
  }
  else {
    L.error('updateContext called with invalid arguments: ' + type + ', ' + remote)
  }
}

Connection.prototype.close = function() {
  this.ws.close();
}

extend(Connection.prototype, helpers);

module.exports = Connection;
