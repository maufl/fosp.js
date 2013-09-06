// Notification class
(function(){
var buildModule = function(Message, L) {
  var Notification = function(con, msg) {
    Message.call(this, con, msg)
  }

  Notification.prototype = Object.create(Message.prototype);

  Notification.prototype.serializeScalpToString = function () {
    return [this.event, this.uri.toString()].join(" ")
  }


  Notification.prototype.validate = function() {
    // Sanity check of message
    if ( this.type !== Message.NOTIFICATION) {
      throw new Error("This notification is no notification");
    }
    if (typeof(this.event) !== "string" || Message.EVENTS.indexOf(this.event) < 0) {
      throw new Error("Unknown event: " + this.event);
    }
    if (typeof this.uri !== "object") {
      throw new Error("Invalid request uri: " + this.uri);
    }
    if (typeof(this.headers) !== 'object') {
      throw new Error("Invalid headers object: " + this.headers);
    }
  };


  Notification.prototype.short = function() {
    return this.event + ' ' + this.uri.toString();
  };

  return Notification;
}
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = buildModule(require('./message'), require('./logger').forFile(__filename));
}
else if (typeof define === 'function' && define.amd) {
  define(['./message','./logger'], function(Message, logger) {
    return buildModule(Message, logger.forFile('fosp/notification'));
  })
}
})();
