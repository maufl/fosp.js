// Manage connections
var events = require('events')
var L = require('./logger').forFile(__filename)

var ConnectionPool = function() {
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
    self.connectionMapping[con.remote] = con;
  })
  con.on('close', function() {
    L.debug('Removing connection from pool');
    var i = self.connections.indexOf(con)
    if (i >= 0)
      self.connections.splice(i, 1)
    if (typeof self.connectionMapping[con.remote] !== 'undefined')
      delete self.connectionMapping[con.remote]
  })
}

ConnectionPool.prototype.get = function(identifier) {
  var con = this.connectionMapping[identifier]
  if (typeof con === 'undefined' || con === null)
    return null
  return con
}

module.exports = ConnectionPool
