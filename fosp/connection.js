// This object type models a fosp connection
var events = require('events')
var extend = require('extend')
var fosp = require('../fosp')
var helpers = require('./connection-helpers')

var Connection = function(ws) {
  var self = this;
  self.ws = ws;
  self.id = Math.floor(Math.random() * 10001);

  // Emit message events on new messages, and also more specific events
  self.ws.on('message', function(message) {
    try {
      var msg = fosp.parseMessage(message);
      self.emit('message', msg);
    }
    catch(e) {
      log(e);
    }
  });

  self.on('message', function(msg) {
    if (msg.type === fosp.REQUEST)
      self.emit('request', msg);
    else if (msg.type === fosp.RESPONSE)
      self.emit('response', msg);
    else if (msg.type === fosp.NOTIFICATION)
      self.emit('notification', msg);
    else
      log('Recieved unknow type of message: ' + msg.type)
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
        log('Recieved unknown request: ' + msg.request)
        break;
    }
  });

  self.on('response', function(msg) {
    switch(msg.response) {
      case 'SUCCEDED':
        self.emit('succeded', msg);
        break;
      case 'FAILED':
        self.emit('failed', msg);
        break;
      default:
        log('Recieved unknown response: ' + msg.response)
        break;
    }
  });

  // TODO on notification
};

Connection.prototype = Object.create(events.EventEmitter.prototype);

Connection.prototype.sendMessage = function(msg) {
  var self = this;
  try {
    var raw = fosp.serializeMessage(msg);
    log("Send message");
    log(raw);
    this.ws.send(raw);
  }
  catch(e) {
    log(e);
  }
}

extend(Connection.prototype, helpers);

var log = function(text) {
  console.log('fosp/connection: ' + text)
}

module.exports = Connection;
