var URI = require('../uri')
var Message = require('../message')
var Notification = require('../notification')
var Connection = require('../connection')
var L = require('../logger').forFile(__filename)

var ServerConnection = function(ws) {
  Connection.call(this, ws);
  var self = this

  self.negotiated = false;
  self.authenticated = false;
  self.type = '';
  self.remote = '';

  self.on('request', function(msg) {
    L.info('Recieved request ' + msg.toString())
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
      case 'READ':
        self.emit('read', msg);
        break;
      case 'WRITE':
        self.emit('write', msg);
        break;
      default:
        L.warn('Recieved unknown request: ' + msg.request)
        break;
    }
  });
}

ServerConnection.prototype = Object.create(Connection.prototype)

ServerConnection.prototype.sendMessage = function(msg) {
  L.info('Sending ' + Message.TYPES[msg.type] + ' ' + msg.toString())
  Connection.prototype.sendMessage.call(this, msg)
}


ServerConnection.prototype.updateContext = function(type, remote) {
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


// Convinience for notifications, not really need atm
ServerConnection.prototype.sendNotification = function(event, uri, headers, body) {
  if (typeof headers === 'undefined')
    headers = {}
  if (typeof body === 'undefined')
    body = null
  if (typeof uri === 'string')
    uri = new URI(uri);
  var msg = new Notification(this, { type: Message.NOTIFICATION, event: event, uri: uri, headers: headers, body: body });
  return this.sendMessage(msg);
}

ServerConnection.prototype.sendCreated = function(uri, headers, body) {
  return this.sendNotification('CREATED', uri, headers, body);
}
ServerConnection.prototype.sendUpdated = function(uri, headers, body) {
  return this.sendNotification('UPDATED', uri, headers, body);
}
ServerConnection.prototype.sendDeleted = function(uri, headers, body) {
  return this.sendNotification('DELETED', uri, headers, body);
}

module.exports = ServerConnection
