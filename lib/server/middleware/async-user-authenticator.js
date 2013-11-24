// generic connection authenticator
var Middleware = require('../middleware')
var L = require('../../logger').forFile(__filename);

var AsyncAuthenticator = function(authFunc) {
  this.authFunc = authFunc;
}

AsyncAuthenticator.prototype = Object.create(Middleware.prototype)

AsyncAuthenticator.prototype.handleAuthenticate = function(msg) {
  L.info('Handle authentication')
  this.authFunc(msg.body.name, msg.body.password, function(err) {
    if (err) {
      L.warn('Authentication unsuccessfull');
      msg.sendFailed(err.status_code || 500, {}, err.message);
      return;
    }
    msg.sendSucceeded(200);
    msg.con.authenticated = true;
    msg.con.updateContext('client', msg.body.name)
    L.info('Successfully authenticated!');
  });
  return false;
}

// Register needs not to be authenticated
AsyncAuthenticator.prototype.handleRegister = function(msg) {
  return true;
}
// Connect needs not to be authenticated
AsyncAuthenticator.prototype.handleConnection = function(msg) {
  return true;
}

AsyncAuthenticator.prototype.defaultHandler = function(msg) {
  return msg.con.authenticated;
}

module.exports = AsyncAuthenticator;
