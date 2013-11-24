// Notification handling happens here
var P = require('../performance')
var L = require('../logger').forFile(__filename)
L.transports.console.level = 'debug'

var NotificationListener = function(server, db) {
  var self = this
  self.server = server
  self.db = db
  self.db.on('created', function(users, uri) {
    self.handleCreated(users,uri)
  })
  self.db.on('updated', function(users, uri) {
    self.handleUpdated(users,uri)
  })
  self.db.on('deleted', function(users, uri) {
    self.handleDeleted(users,uri)
  })
  server.on('notification', function(msg) {
    var user = msg.headers['User']
    if (typeof user !== 'string') {
      L.error('Recieved notification but no User header was present: ' + msg.headers)
      return
    }
    var cons = server.connectionPool.getAll(user)
    if (cons === null) {
      L.warn('User ' + user + ' should be notified but is not connected')
      return
    }
    for (var i=0; i<cons.length; i++) {
      L.info('Sending notification to user ' + user + ' on ' + i + ' connection')
      cons[i].sendNotification(msg.event, msg.uri, {}, msg.body)
    }
  })

}
NotificationListener.prototype.handleCreated = function(users, uri) {
  L.info(uri.toString() + ' was created, following users should be notified: ' + users)
  this.forEachUserWithNode(users, uri,
    function(con, uri, node) {
      con.sendCreated(uri, {}, node)
    },
    function(con, uri, node, user_name) {
      con.sendCreated(uri, {User: user_name}, node)
    })
}
NotificationListener.prototype.handleUpdated = function(users, uri) {
  P.log('Entering NotificationListener.handleUpdate')
  L.info(uri.toString() + ' was updated, following users should be notified: ' + users)
  this.forEachUserWithNode(users, uri,
    function(con, uri, node) {
      con.sendUpdated(uri, {}, node)
    },
    function(con, uri, node, user_name) {
      con.sendUpdated(uri, {User: user_name}, node)
    })
}
NotificationListener.prototype.handleDeleted = function(users, uri) {
  L.info(uri.toString() + ' was deleted, following users should be notified: ' + users)
  for (var i=0; i < users.length; i++) {
    var user = users[i]
    var name = user.substring(0, user.indexOf('@'))
    var domain = user.substring(user.indexOf('@') + 1, user.length)
    L.debug('Notifying user ' + name + ' on domain ' + domain)
    if (domain === this.server.local_domain) {
      L.debug('Is local user')
      var cons = this.server.connectionPool.getAll(name)
      if (cons !== null) {
        for (var j=0; j<cons.length; j++)
          cons[j].sendDeleted(uri)
      }
      else {
        L.info('User ' + name + ' is not connected, no notification was sent')
      }
    }
    else {
      this.server.connectionPool.getOrCreateOne(domain, function(err, con) {
        if (con)
          con.sendDeleted(uri, {User: name})
        else
          L.warn('Error when connecting to remote domain ' + domain + ': ' + err)
      })
    }
  }
}

NotificationListener.prototype.forEachUserWithNode = function(users, uri, callbackLocal, callbackRemote) {
  var self = this
  P.log('Entering NotificationListener.forEachUserWithNode')
  self.db.selectForUsers(users, uri, function(err, user, node) {
    P.log('Entering NotificationListener.forEachUserWithNode callback function')
    if (err) {
      L.warn('An error occured when fetching node ' + uri.toString() + ' for user ' + user + ': ' + err);
      return;
    }
    var name = user.substring(0, user.indexOf('@'))
    var domain = user.substring(user.indexOf('@') + 1, user.length)
    L.info('Sending notification to user ' + name + ' on domain ' + domain)
    if (domain === self.server.local_domain) {
      L.debug('User is on local domain')
      var cons = self.server.connectionPool.getAll(name)
      if (cons !== null) {
        for (var i=0; i<cons.length; i++)
          callbackLocal(cons[i], uri, node)
      }
      else {
        L.info('User is not connected, no notification was sent')
      }
      P.log('Leaving NotificationListener.forEachUserWithNode callback function')
    }
    else {
      L.debug('User is on a remote domain')
      self.server.connectionPool.getOrCreateOne(domain, function(err, con) {
        if (con)
          callbackRemote(con, uri, node, user)
        else
          L.warn('Error while connecting to remote domain: ' + err)
      })
      P.log('Leaving NotificationListener.forEachUserWithNode callback function')
    }
  })
}

module.exports = NotificationListener
