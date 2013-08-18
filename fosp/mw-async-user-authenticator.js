// generic connection authenticator
var Middleware = require('./middleware')
var L = require('./logger').forFile(__filename);

var AsyncAuthenticator = function(authFunc) {
  this.authFunc = authFunc;
}

AsyncAuthenticator.prototype = Object.create(Middleware.prototype)

AsyncAuthenticator.prototype.handleAuthenticate = function(msg) {
  L.info('Handle authentication')
  this.authFunc(msg.body.name, msg.body.password, function(success) {
    L.info('User is authenticated ' + success);
    if (success) {
      msg.sendSucceded(200);
      msg.con.updateContext('client', msg.body.name)
      msg.con.authenticated = true;
      L.info('Successfully authenticated!');
      return;
    }
    L.info('Authentication unsuccessfull');
    msg.sendFailed(401);
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
