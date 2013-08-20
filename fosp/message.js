// Everything message related
(function(){
var buildModule = function(events, extend) {

  var Message = function(con, msg) {
    this.con = con
    extend(true,this,msg)
    // Set default values for headers and body
    this.headers = typeof this.headers === 'undefined' ? {} : this.headers
    this.body = typeof this.body === 'undefined'? null : this.body
  }

  Message.REQUESTS = ["CONNECT", "AUTHENTICATE", "REGISTER", "CREATE", "UPDATE", "DELETE", "SELECT", "LIST"];
  Message.RESPONSES = ["SUCCEDED", "FAILED"];
  Message.EVENTS = ["CREATED", "UPDATED", "DELETED"];
  Message.REQUEST = 1;
  Message.RESPONSE = 2;
  Message.NOTIFICATION = 3;

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

  return Message;
}
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = buildModule(require('events'), require('extend'));
}
else if (typeof define === 'function' && define.amd) {
  define(['events','jquery'], function(events, jquery) {
    return buildModule(events, jquery.extend);
  })
}
})();
