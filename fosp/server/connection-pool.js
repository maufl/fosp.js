// Manage connections
var events = require('events')
var util = require('util')
var WebSocket = require('websocket')
var L = require('../logger').forFile(__filename)
L.transports.console.level = 'debug'

var ConnectionPool = function(server) {
  this.server = server
  this.connections = []
  this.connectionMapping = {};
}

ConnectionPool.prototype = Object.create(events.EventEmitter.prototype)

ConnectionPool.prototype.push = function(con) {
  var self = this
  L.debug('Adding new connection to pool')
  self.connections.push(con);
  con.on('context-updated', function() {
    L.debug('Updating mapping of connection')
    if (! util.isArray(self.connectionMapping[con.remote]) )
      self.connectionMapping[con.remote] = []
    self.connectionMapping[con.remote].push(con);
    L.verbose('Connection pool is now')
    L.verbose(util.inspect(self))
  })
  con.on('close', function() {
    L.debug('Removing connection from pool');
    var i = self.connections.indexOf(con)
    if (i >= 0)
      self.connections.splice(i, 1)
    if (util.isArray(self.connectionMapping[con.remote])) {
      var i = self.connectionMapping[con.remote].indexOf(con)
      if (i >= 0)
        self.connectionMapping[con.remote].splice(i, 1)
    }
    L.verbose('Connection pool is now')
    L.verbose(util.inspect(self))
  })
  L.verbose('Connection pool is now')
  L.verbose(util.inspect(self))
}

ConnectionPool.prototype.getOne = function(identifier) {
  var cons = this.connectionMapping[identifier]
  if (util.isArray(cons) && cons.length >= 1)
    return cons[0]
  return null
}

ConnectionPool.prototype.getOrCreateOne = function(domain, callback) {
  var self = this, con = self.getOne(domain)
  if (con) {
    L.info('Found existing connection to ' + domain);
    callback(null, con)
    return
  }
  L.info('Did not find a existing connection to ' + domain);
  try {
    L.info('Open new connection to ' + domain);
    var newWs = new WebSocket.client()
    newWs.connect('ws://'+domain+':'+self.server.port);
    newWs.on('connect', function(con) {
      var newCon = new Connection(con);
      self.push(newCon);
      newCon.sendConnect({}, {version: '0.1'}).on('succeded', function() {
        newCon.sendAuthenticate({}, {type: 'server', domain: self.server.local_domain}).on('succeded', function() {
          callback(null, newCon);
          newCon.updateContext('server', domain)
        }).on('failed', function() {
          var err = new Error('Could not authenticate with remote domain')
          err.status_code = 502
          callback(err, null);
        });
      }).on('failed', function() {
        var err = new Error('Could not negotiate with remote domain')
        err.status_code = 502
        callback(err, null);
      });
    });
    newWs.on('error', function(err) {
      var err = new Error('Error occured when connection to remote domain: ' + err)
      err.status_code = 502
      L.warn('Error occured when connecting to remote domain: ' + err);
      callback(err, null)
    });
  }
  catch (e) {
    L.error('Error when opening a new connection: ' + e);
    var err = new Errror('Error when opening a new connection: ' + e)
    callback(err);
  }
}

module.exports = ConnectionPool
