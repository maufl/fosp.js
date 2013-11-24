// authenticator that uses dns lookups to authenticate a server
var dns = require('dns')
var Middleware = require('../middleware')
var L = require('../../logger').forFile(__filename)

var DnsServerAuthenticator = function() {
}

DnsServerAuthenticator.prototype = Object.create(Middleware.prototype)

DnsServerAuthenticator.prototype.handleAuthenticate = function(msg) {
  if (msg.body.type !== 'server') {
    L.debug('Auth request is not from server, passing it on')
    return true
  }
  L.info('Authenticating remote server ' + msg.body.domain);
  L.debug(msg.toString())
  L.debug('Remote address is ' + msg.con.ws.remoteAddress)
  var remote_ip = msg.con.ws.remoteAddress;
  var presented_domain = msg.body.domain;
  dns.lookup(presented_domain, 4, function(err, address, family) {
    L.info('DNS lookup returned error ' + err + ' and address ' + address)
    if (err) {
      L.warn('Failed to authenticate server, DNS failed: ' + err)
      msg.sendFailed(402);
    }
    else if(remote_ip !== address) {
      L.warn('Failed to authenticate server, provided domain did not match resolved IP address!')
      msg.sendFailed(402);
    }
    else {
      L.info('Successfully authenticated remote server for domain '+presented_domain+'!')
      msg.sendSucceeded(200);
      msg.con.updateContext('server', presented_domain)
      msg.con.authenticated = true;
    }
  })
  return false;
}

module.exports = DnsServerAuthenticator;
