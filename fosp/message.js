// Everything message related
var events = require('events');
var extend = require('extend');

var REQUESTS = ["CONNECT", "AUTHENTICATE", "REGISTER", "CREATE", "UPDATE", "DELETE", "SELECT", "LIST"];
var RESPONSES = ["SUCCEDED", "FAILED"];
var EVENTS = ["CREATED", "UPDATED", "DELETED"];
var REQUEST = 1;
var RESPONSE = 2;
var NOTIFICATION = 3;


// Actuall message class definition

var Message = function(con, msg) {
  this.con = con
  extend(true,this,msg)
  // Set default values for headers and body
  this.headers = typeof this.headers === 'undefined' ? {} : this.headers
  this.body = typeof this.body === 'undefined'? null : this.body
}

Message.REQUESTS = REQUESTS;
Message.RESPONSES = RESPONSES;
Message.EVENTS = EVENTS;
Message.REQUEST = REQUEST;
Message.RESPONSE = RESPONSE;
Message.NOTIFICATION = NOTIFICATION;

Message.prototype = Object.create(events.EventEmitter.prototype);

Message.prototype.serializeHeaders = function() {
  var raw = ''
  for (k in this.headers) {
    raw += k + ": " + this.headers[k] + "\r\n";
  }
  return raw;
}

Message.prototype.serializeBody = function() {
  if (typeof this.body !== 'undefined' && this.body !== null)
    return "\r\n" + JSON.stringify(this.body);
  return '';
}

Message.prototype.toString = function() {
  return this.short() + ' :: ' + JSON.stringify(this.body);
}

module.exports = Message;
