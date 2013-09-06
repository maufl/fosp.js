// Everything message related
(function(){
var buildModule = function(L, events, extend) {

  var Message = function(con, msg) {
    this.con = con
    extend(true,this,msg)
    // Set default values for headers and body
    this.headers = typeof msg.headers === 'undefined' ? {} : this.headers
    this.body = typeof msg.body === 'undefined'? null : this.body
  }

  Message.REQUESTS = ["CONNECT", "AUTHENTICATE", "REGISTER", "CREATE", "UPDATE", "DELETE", "SELECT", "LIST", "READ", "WRITE"];
  Message.RESPONSES = ["SUCCEDED", "FAILED"];
  Message.EVENTS = ["CREATED", "UPDATED", "DELETED"];
  Message.REQUEST = 1;
  Message.RESPONSE = 2;
  Message.NOTIFICATION = 3;
  Message.TYPES = ['','request', 'response', 'notification']
  Message.BufferClass = typeof Buffer === 'undefined' ? ArrayBuffer : Buffer;

  Message.prototype = Object.create(events.EventEmitter.prototype);

  Message.prototype.serializeHeadersToString = function() {
    var raw = ''
    for (k in this.headers) {
      raw += k + ": " + this.headers[k] + "\r\n";
    }
    return raw;
  }

  Message.prototype.serializeBodyToString = function() {
    if (typeof this.body !== 'undefined' && this.body !== null)
      return "\r\n" + JSON.stringify(this.body);
    return '';
  }

  Message.prototype.serialize = function() {
    L.debug("Serializing " + Message.TYPES[this.type]);
    this.validate();

    var head = this.serializeScalpToString() + "\r\n" + this.serializeHeadersToString();

    // Serialize body to string
    if (! (this.body instanceof Message.BufferClass))
      return  head + this.serializeBodyToString();

    L.debug('Is binary message, serializing to buffer')
    L.verbose('Body:\n' + this.body.toString())
    // Serialize body to buffer
    var body_length = (this.body.byteLength || this.body.length)
    if ( body_length > 0)
      head += "\r\n"
    var headUTF8Array = Message.stringToUTF8Array(head), head_length = headUTF8Array.length
    var serializedMessage = new Message.BufferClass(head_length + body_length)
    var body = this.body
    if (Message.BufferClass === ArrayBuffer) {
      serializedMessage = new Uint8Array(serializedMessage)
      body = new Uint8Array(body)
    }
    for (var i=0; i<head_length; i++)
      serializedMessage[i] = headUTF8Array[i]
    for (var i=0; i<body_length; i++)
      serializedMessage[i+head_length] = body[i]
    L.verbose('Serialized message:\n' + serializedMessage.toString())
    return serializedMessage;
  }

  Message.prototype.serializeScalpToString = function() {
    throw new Error('Scalp serializing not implemented!')
  }

  Message.prototype.toString = function() {
    if (this.body instanceof Message.BufferClass)
      return this.short() + ' :: [binary data]'
    return this.short() + ' :: ' + JSON.stringify(this.body);
  }

  Message.stringToUTF8Array = function(str) {
    var utf8 = [];
    for (var i=0; i < str.length; i++) {
      var charcode = str.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6),
            0x80 | (charcode & 0x3f));
      }
      else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(0xe0 | (charcode >> 12),
            0x80 | ((charcode>>6) & 0x3f),
            0x80 | (charcode & 0x3f));
      }
      else {
        // let's keep things simple and only handle chars up to U+FFFF...
        utf8.push(0xef, 0xbf, 0xbd); // U+FFFE "replacement character"
      }
    }
    return utf8;
  }

  return Message;
}
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = buildModule(require('./logger').forFile(__filename), require('events'), require('extend'));
}
else if (typeof define === 'function' && define.amd) {
  define(['./logger', 'EventEmitter','jquery'], function(logger, EventEmitter, jquery) {
    return buildModule(logger.forFile('fosp/message'), {EventEmitter: EventEmitter}, jquery.extend);
  })
}
})();
