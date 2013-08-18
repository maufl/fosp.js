// authenticator that uses dns lookups to authenticate a server
var dns = require('dns')
var Middleware = require('./middleware')
var L = require('./logger').forFile(__filename)

var DnsSeverAuthenticator = function() {
}

DnsServerAuthenticator.prototype = Object.create(Middleware.prototype)

DnsServerAuthenticator.prototype.handleAuthenticate = function(msg) {
  if (msq.body.type !== 'server')
    return true
  L.debug(msg.con.ws)
  L.debug(msg.con.ws.origin)
  var remote_ip = msg.con.ws.origin;
  var presented_domain = msg.body.domain;
  dns.lookup(presented_domain, 4, function(err, address, family) {
    if (err) {
      msg.sendFailed(402);
    }
    else if(remote_ip !== address) {
      msg.sendFailed(402);
    }
    else {
      msg.sendSucceded(200);
      msg.con.ctx.authenticated = true;
    }
  })
  return false;
}

module.exports = DnsServerAuthenticator;
