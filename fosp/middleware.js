// baseclass for all middleware

var Middleware = function() {

}

Middleware.prototype.handle = function(eventId, msg) {
  var handleName = 'handle' + capitaliseFirstLetter(eventId);
  if (typeof this[handleName] === 'function')
    return this[handleName](msg);
  else
    return this.defaultHandler(msg)
}

Middleware.prototype.defaultHandler = function(msg) {
  return true;
}

Middleware.prototype.handleMessage = Middleware.prototype.defaultHandler;
Middleware.prototype.handleRequest = Middleware.prototype.defaultHandler;
Middleware.prototype.handleResponse = Middleware.prototype.defaultHandler;
Middleware.prototype.handleNotification = Middleware.prototype.defaultHandler;

var capitaliseFirstLetter = function(string)
{
      return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = Middleware;
