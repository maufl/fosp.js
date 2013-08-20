// Response class
(function(){
var buildModule = function(Message, L) {
  var Response = function(con, msg) {
    Message.call(this,con,msg)
  }

  Response.prototype = Object.create(Message.prototype);

  Response.prototype.serialize = function() {
    L.debug("Serializing message");
    this.validate();

    return [this.response, this.status, this.seq].join(" ") + "\r\n"
            + this.serializeHeaders()
            + this.serializeBody();

  };

  Response.prototype.validate = function() {
    // Sanity check of message
    if (this.type !== Message.RESPONSE) {
      throw new Error("This response is no response!");
    }
    if (typeof(this.response) !== "string" || Message.RESPONSES.indexOf(this.response) < 0) {
      throw new Error("Unknown response" + this.response);
    }
    if (typeof(this.status) !== "number" || this.status <= 0) {
      throw new Error("Unknown response status: " + this.status);
    }
    if (typeof this.seq !== 'number' || this.seq <= 0) {
      throw new Error("Missing request sequence number: " + this.seq);
    }
    if (typeof(this.headers) !== 'object') {
      throw new Error("Invalid headers object: " + this.headers);
    }
  };

  Response.prototype.short = function() {
      return this.response + ' ' + this.status + ' ' + this.seq;
  };

  return Response;
}
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = buildModule(require('./message'), require('./logger').forFile(__filename));
}
else if (typeof define === 'function' && define.amd) {
  define(['./message','./logger'], function(Message, logger) {
    return buildModule(Message, logger.forFile('fosp/response'));
  })
}
})();
