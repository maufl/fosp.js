// Notification handling happens here
var L = require('../logger').forFile(__filename)
L.transports.console.level = 'debug'

var NotificationListener = function(server, db) {
  var self = this
  self.server = server
  self.db = db
  self.db.on('created', function(users, path) {
    self.handleCreated(users,path)
  })
  self.db.on('updated', function(users, path) {
    self.handleUpdated(users,path)
  })
  self.db.on('deleted', function(users, path) {
    self.handleDeleted(users,path)
  })
}
NotificationListener.prototype.handleCreated = function(users, path) {
  L.info(path + ' was created, following users should be notified: ' + users)
  this.forEachUserWithNode(users, path,
    function(con, path, node) {
      con.sendCreated(path, {}, node)
    },
    function(con, path, node, user_name) {
      con.sendCreated(path, {User: user_name}, node)
    })
}
NotificationListener.prototype.handleUpdated = function(users, path) {
  L.info(path + ' was updated, following users should be notified: ' + users)
  this.forEachUserWithNode(users, path,
    function(con, path, node) {
      con.sendUpdated(path, {}, node)
    },
    function(con, path, node, user_name) {
      con.sendUpdated(path, {User: user_name}, node)
    })
}
NotificationListener.prototype.handleDeleted = function(users, path) {
  L.info(path + ' was deleted, following users should be notified: ' + users)
  for (var i=0; i < users.length; i++) {
    var user = users[i]
    var name = user.substring(0, user.indexOf('@'))
    var domain = user.substring(user.indexOf('@') + 1, user.length)
    L.debug('Notifying user ' + name + ' on domain ' + domain)
    if (domain === this.server.local_domain) {
      L.debug('Is local user')
      var con = this.server.connectionPool.getOne(name)
      if (con)
        con.sendDeleted(path)
      else
        L.info('User ' + name + ' is not connected, no notification was sent')
    }
    else {
      this.server.connectionPool.getOrCreateOne(domain, function(err, con) {
        if (con)
          con.sendDeleted(path, {User: name})
        else
          L.warn('Error when connecting to remote domain ' + domain + ': ' + err)
      })
    }
  }
}

NotificationListener.prototype.forEachUserWithNode = function(users, path, callbackLocal, callbackRemote) {
  var self = this
  for (var i=0; i < users.length; i++) {
    var user = users[i]
    this.db.select(user, path, function(err, node) {
      if (err) {
        L.warn('An error occured when fetching node ' + path + ' for user ' + user + ': ' + err)
        return
      }
      var name = user.substring(0, user.indexOf('@'))
      var domain = user.substring(user.indexOf('@') + 1, user.length)
      L.info('Sending notification to user ' + name + ' on domain ' + domain)
      if (domain === self.server.local_domain) {
        L.debug('User is on local domain')
        var con = self.server.connectionPool.getOne(name)
        if (con)
          callbackLocal(con, path, node)
        else
          L.info('User is not connected, no notification was sent')
      }
      else {
        L.debug('User is on a remote domain')
        self.server.connectionPool.getOrCreateOne(domain, function(err, con) {
          if (con)
            callbackRemote(con, path, node, user_name)
          else
            L.warn('Error while connecting to remote domain: ' + err)
        })
      }
    })
  }
}

module.exports = NotificationListener
