// generic connection authenticator
var Middleware = require('./middleware')

var AsyncAuthenticator = function(authFunc) {
  this.authFunc = authFunc;
}

AsyncAuthenticator.prototype = Object.create(Middleware.prototype)

AsyncAuthenticator.prototype.handleAuthenticate = function(msg) {
  if (msg.body.type === 'server') {
    msg.con.ctx.authenticated = true;
    msg.sendSucceded(200);
    return false;
  }
  log('Handle authentication')
  this.authFunc(msg.body.name, msg.body.password, function(success) {
    log('User is authenticated ' + success);
    if (success) {
      msg.sendSucceded(200);
      msg.con.ctx.authenticated = true;
      log('Successfully authenticated!');
      return;
    }
    log('Authentication unsuccessfull');
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
  return msg.con.ctx.authenticated;
}

var log = function(text) {
  console.log('fosp/authenticator: ' + text);
}

module.exports = AsyncAuthenticator;
