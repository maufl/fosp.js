// do all database stuff here
var moment = require('moment')
var extend = require('extend')
var events = require('events')
var Q = require('q')
var URI = require('../uri')
var L = require('../logger').forFile(__filename);
var P = require('../performance')

var DatabaseAbstractionLayer = function(dbDriver) {
  var self = this
  self.dbDriver = dbDriver
}

DatabaseAbstractionLayer.prototype = Object.create(events.EventEmitter.prototype)

DatabaseAbstractionLayer.DatabaseError = function(msg) {
  Error.call(this, (msg || 'Database error'))
}
DatabaseAbstractionLayer.DatabaseError.prototype = Object.create(Error.prototype)

var isSubset = function(set, subset) {
  if (set.length < subset.length)
    return false

  for (var i = 0; i<subset.length; i++) {
    if (set.indexOf(subset[i]) < 0)
      return false
  }
  return true
}

var permissionsFor = function(user, node) {
  if (typeof node === 'object' && node !== null
      && typeof node.acl === 'object' && node.acl !== null
      && typeof node.acl[user] === 'object' && node.acl[user] !== null)
    return node.acl[user]

  return []
}

var sumPermissions = function(user, nodes) {
  var permissionSum = []
  for (var i=0; i<nodes.length; i++) {
    var permissions = permissionsFor(user, nodes[i])
    for (var j=0; j<permissions.length; j++) {
      var permission = permissions[j]
      if (permission.match(/^not-/)) {
        var positive = permission.substring(4, permission.length)
        var index = permissionSum.indexOf(positive)
        if (index >= 0)
          permissionSum.splice(index, 1)
      }
      else {
        var index = permissionSum.indexOf(permission)
        if (index < 0)
          permissionSum.push(permission)
      }
    }
  }
  return permissionSum
}

var augmentPermissions = function(base, extension) {
  var result = base.slice()
  for (var i=0; i < extension.length; i++) {
    var perm = extension[i]
    if (perm.match(/^not-/)) {
      var positive = perm.substring(4, perm.length)
      var index = result.indexOf(positive)
      if (index >= 0)
        result.splice(index, 1)
    }
    else {
      var negative = 'not-' + perm
      var index = result.indexOf(negative)
      if (index >= 0)
        result.splice(index, 1)
    }
    if (result.indexOf(perm < 0))
      result.push(perm)
  }
  return result
}

var effectiveACL = function(nodes) {
  var acl = {}
  for (var i=0; i < nodes.length; i++) {
    var node = nodes[i]
    if (! node.acl)
      continue

    for (user in node.acl)
      acl[user] = augmentPermissions(acl[user] || [], node.acl[user] || [])
  }
  return acl
}

var effectiveSubscriptions = function(nodes, event) {
  var users = []
  for (var i=0; i<nodes.length; i++) {
    var node = nodes[i]
    if (typeof node.subscriptions !== 'object' || node.subscriptions === null)
      continue
    for (user in node.subscriptions) {
      var subscription = node.subscriptions[user]
      if (subscription === null)
        continue
      if (subscription.events.indexOf(event) >= 0
          && ( subscription.depth === -1 || subscription.depth >= i)) {
        L.debug('Subscription in node ' + i + ' lets user ' + user + ' recieve event ' + event)
        users.push(user)
      }
    }
  }
  return users
}

// callback gets following parameters: Error, Permissions, Node
DatabaseAbstractionLayer.prototype.permissionsFor = function(user, uri) {
  P.log('Entering DatabaseAbstractionLayer.permissionsFor')
  var self = this, d = Q.defer()
  self.dbDriver.getNodeWithParents(uri).then(function(nodes) {
    var permissions = sumPermissions(user, nodes);
    d.resolve([permissions, nodes[nodes.length - 1]])
    P.log('Leaving DatabaseAbstractionLayer.permissionsFor')
  }).catch(function(err) {
    d.reject(err)
  })
  return d.promise
}

DatabaseAbstractionLayer.prototype.authenticateFor = function(user, uri, permissions) {
  P.log('Entering DatabaseAbstractionLayer.authenticateFor')
  var self = this, d = Q.defer()
  this.permissionsFor(user, uri).then(function(val) {
    var existingPermissions = val.shift(), node = val.shift()
    if (isSubset(existingPermissions, permissions)) {
      d.resolve(node)
    }
    else {
      L.warn('User ' + user + ' wants to access ' + uri.toString() + ' with permissions ' + permissions + ' but only has permissions ' + existingPermissions + '!')
      var err = new Error('Insufficent permissions')
      err.status_code = 403
      d.reject(err)
    }
    P.log('Leaving DatabaseAbstractionLayer.authenticateFor')
  }).catch(function(err) {
      d.rejece(err)
  })
  return d.promise
}

DatabaseAbstractionLayer.prototype.select = function(user, uri, callback) {
  var self = this
  this.dbDriver.nodeExists(uri).then(function() {
    return self.permissionsFor(user, uri)
  }).then(function(val) {
    var permissions = val.shift(), node = val.shift()
    if (permissions.length === 0) {
      err = new Error('Insufficent permissions');
      err.status_code = 403;
      callback(err, null);
      return;
    }
    var result = {}
    result.owner = node.owner
    result.btime = node.btime
    result.mtime = node.mtime
    if (permissions.indexOf('data-read') >= 0)
      result.data = node.data
    if (permissions.indexOf('acl-read') >= 0)
      result.acl = node.acl
    if (permissions.indexOf('subscriptions-read') >= 0)
      result.subscriptions = node.subscriptions
    if (permissions.indexOf('attachment-read') >= 0)
      result.attachment = node.attachment
    callback(null, result);
  }).catch(function(err) {
    callback(err)
  })
}

DatabaseAbstractionLayer.prototype.selectForUsers = function(users, uri, callback) {
  if (users.length === 0)
    return

  var self = this
  P.log('Entering DatabaseAbstractionLayer.selectForUsers')
  self.dbDriver.getNodeWithParents(uri).then(function(nodes) {
    var acl = effectiveACL(nodes)
    var node = nodes[nodes.length - 1]
    for (var i=0; i<users.length; i++) {
      P.log('Entering DatabaseAbstractionLayer.selectForUsers for-loop')
      var user = users[i]
      var permissions = acl[user] || []
      var result = {}
      result.owner = node.owner
      result.btime = node.btime
      result.mtime = node.mtime
      if (permissions.indexOf('data-read') >= 0)
        result.data = node.data
      if (permissions.indexOf('acl-read') >= 0)
        result.acl = node.acl
      if (permissions.indexOf('subscriptions-read') >= 0)
        result.subscriptions = node.subscriptions
      if (permissions.indexOf('attachment-read') >= 0)
        result.attachment = node.attachment
      callback(null, user, result)
      P.log('Leaving DatabaseAbstractionLayer.selectForUsers for-loop')
    }
    P.log('Leaving DatabaseAbstractionLayer.selectForUsers')
  }).catch(function(err) {
    L.error('Error occured when fetching node for multiple users')
    L.error(err.stack)
  })
}

DatabaseAbstractionLayer.prototype.list = function(user, uri, callback) {
  var self = this
  self.authenticateFor(user, uri, ['children-read']).then(function(node) {
    self.dbDriver.listChildren(uri).then(function(children) {
      callback(null, children)
    }).catch(function(err) {
      L.error(err.stack)
      callback(err, null)
    })
  }).catch(function(err) {
    L.error(err.stack)
    callback(err)
  })
}

DatabaseAbstractionLayer.prototype.prepareNotifications = function(uri, event) {
  var self = this
  var usersToNotify = []
  var fired = false
  var calculated = false
  self.dbDriver.getNodeWithParents(uri).then(function(nodes) {
    L.debug('Preparing notification for node ' + uri.toString())
    usersToNotify = effectiveSubscriptions(nodes.reverse(), event)
    L.debug('Notifications for event ' + event + ' on ' + uri.toString() + ' go to ' + usersToNotify)
    if (fired)
      setTimeout(function() { self.emit(event, usersToNotify, uri) }, 50)
    else
      calculated = true
  }).catch(function(err) {
      L.warn('An error occured when trying to determin notifications for created: ' + err)
  })
  return { fire: function() {
    if (calculated)
      setTimeout(function() { self.emit(event, usersToNotify, uri) }, 50)
    else
      fired = true
  } }
}

DatabaseAbstractionLayer.prototype.create = function(user, uri, content, callback) {
  var self = this
  var neededPermissions = ['children-write']
  for (key in content) {
    if (['data', 'acl', 'subscription', 'attachment'].indexOf(key) < 0) {
      var err = new Error('Tried to write to a non standart field');
      err.status_code = 422
      callback(err, null)
      return
    }
    else {
      neededPermissions.push(key+'-write')
    }
  }
  self.authenticateFor(user, uri.parent(), neededPermissions).then(function(node) {
    self.dbDriver.nodeExists(uri).then(function() {
      var err = new Error('Node already exists')
      err.status_code = 409
      callback(err, null)
    }).catch(function(err) {
      if (err instanceof DatabaseAbstractionLayer.DatabaseError) {
        callback(err)
        return
      }
      content = content || {}
      content.owner = user
      content.btime = moment().toISOString()
      content.mtime = moment().toISOString()
      self.dbDriver.createNode(uri, content).then(function() {
        callback(null)
        self.prepareNotifications(uri, 'created').fire();
      }).catch(function(err) {
        callback(err)
      })
    })
  }).catch(function(err) {
    callback(err, null)
  })
}

DatabaseAbstractionLayer.prototype.update = function(user, uri, content, callback) {
  P.log('Entering DatabaseAbstractionLayer.update')
  var self = this
  var neededPermissions = []
  for (key in content) {
    if (['data', 'acl', 'subscriptions', 'attachment'].indexOf(key) < 0) {
      var err = new Error('Tried to write to a non standart field');
      err.status_code = 422
      callback(err, null)
      return
    }
    else {
      neededPermissions.push(key+'-write')
    }
  }
  self.authenticateFor(user, uri, neededPermissions).then(function(node) {
    P.log('Entering DAL update chained callback')
    if (content.attachment)
      extend(true, node, { attachment: content.attachment })
    if (content.data)
      extend(true, node, { data: content.data })
    if (content.subscriptions) {
      var subs = content.subscriptions
      if (typeof node.subscriptions !== 'object')
        node.subscriptions = {}
      for (user in subs) {
        if (subs[user] === null)
          node.subscriptions[user] = null
        else
          node.subscriptions[user] = { events: subs[user].events, depth: subs[user].depth }
      }
    }
    if (content.acl) {
      if (node.acl === null || typeof node.acl === 'undefined') {
        node.acl = content.acl
      }
      else {
        for (user in content.acl) {
          if (typeof node.acl[user] === 'undefined' || node.acl[user] === null) {
            node.acl[user] = content.acl[user]
          }
          else if (content.acl[user] === null) {
            node.acl[user] = null
          }
          else {
            var perms = content.acl[user]
            var existingPerms = node.acl[user]
            for (var i=0; i<perms.length; i++) {
              var perm = perms[i]
              if (existingPerms.indexOf(perm) < 0) {
                node.acl[user].push(perm)
                var negated = perm.match('^not-') ? perm.substring(4,perm.length) : 'not-'+perm
                var index = existingPerms.indexOf(negated)
                if (index >= 0)
                  node.acl[user].splice(index,1)
              }
            }
          }
        }
      }
    }
    node.mtime = moment().toISOString()
    P.log('Leaving DAL update chained callback')
    self.dbDriver.updateNode(uri, node).then(function() {
      P.log('Entering DAL.update chained callback for updateNode')
      callback(null)
      P.log('Done invoking callback of DAL.update')
      self.prepareNotifications(uri, 'updated').fire();
      P.log('Leaving DAL.update chained callback for updateNode')
    }).catch(function(err) {
      callback(err)
    })
  }).catch(function(err) {
    callback(err, null)
  })
  P.log('Leaving DatabaseAbstractionLayer.update')
}

DatabaseAbstractionLayer.prototype.delete = function(user, uri, callback) {
  var self = this
  if (uri.isRoot()) {
    var err = new Error('Cannot delete root node')
    err.status_code = 403
    callback(err)
    return
  }
  self.authenticateFor(user, uri.parent(), ['children-delete']).then(function(node) {
    var notifications  = self.prepareNotifications(uri, 'deleted');
    self.dbDriver.deleteNode(uri).then(function() {
      callback(null)
      notifications.fire()
    }).catch(function(err) {
      callback(err)
    })
  }).catch(function(err) {
    L.error(err.stack)
    callback(err)
  })
}

DatabaseAbstractionLayer.prototype.addUser = function(name, domain, password, callback) {
  this.dbDriver.addUser(name, domain, password).then(function() {
    callback(null)
  }).catch(function(err) {
    callback(err)
  })
}

DatabaseAbstractionLayer.prototype.authenticateUser = function(name, password, callback) {
  this.dbDriver.authenticateUser(name, password).then(function() {
    callback(null)
  }).catch(function(err) {
    callback(err)
  })
}

DatabaseAbstractionLayer.prototype.readAttachment = function(user, uri, callback) {
  var self = this
  self.authenticateFor(user, uri, ['attachment-read']).then(function() {
    return self.dbDriver.readAttachment(uri)
  }).then(function(buffer) {
    callback(null, buffer)
  }).catch(function(err) {
    callback(err, null)
  })
}

DatabaseAbstractionLayer.prototype.writeAttachment = function(user, uri, buffer, callback) {
  var self = this
  self.authenticateFor(user, uri, ['attachment-write']).then(function() {
    return self.dbDriver.writeAttachment(uri, buffer)
  }).then(function() {
    callback(null)
  }).catch(function(err) {
    callback(err)
  })
}
module.exports = DatabaseAbstractionLayer;
