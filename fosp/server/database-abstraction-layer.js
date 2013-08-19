// do all database stuff here
var moment = require('moment')
var extend = require('extend')
var events = require('events')
var URI = require('../uri')
var L = require('../logger').forFile(__filename);
L.transports.console.level = 'debug'

var DatabaseAbstractionLayer = function(dbDriver) {
  var self = this
  self.dbDriver = dbDriver
}

DatabaseAbstractionLayer.prototype = Object.create(events.EventEmitter.prototype)

var isSubset = function(set, subset) {
  for (var i = 0; i<subset.length; i++) {
    if (set.indexOf(subset[i]) < 0)
      return false
  }
  return true
}

var permissionsFor = function(user, node) {
  if (typeof node === 'object' && node !== null
      && typeof node.acl === 'object' && node.acl !== null
      && typeof node.acl[user] === 'object')
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

var effectiveSubscriptions = function(nodes, event) {
  var users = []
  for (var i=0; i<nodes.length; i++) {
    var node = nodes[i]
    if (typeof node.subscriptions !== 'object' || node.subscriptions === null)
      continue
    for (user in node.subscriptions) {
      var subscription = node.subscriptions[user]
      if (subscription.events.indexOf(event) >= 0
          && ( subscription.depth === -1 || subscription.depth >= i))
        users.push(user)
    }
  }
  return users
}

// callback gets following parameters: Error, Permissions, Node
DatabaseAbstractionLayer.prototype.permissionsFor = function(user, path, callback) {
  var self = this
  self.dbDriver.getNodeWithParents(path, function(err, nodes) {
    if (err) {
      callback(err, null, null)
      return
    }
    var permissions = sumPermissions(user, nodes);
    callback(null, permissions, nodes[nodes.length - 1])
  })
}

DatabaseAbstractionLayer.prototype.authenticateFor = function(user, path, permissions, callback) {
  this.permissionsFor(user, path, function(err, existingPermissions, node) {
    if (err) {
      callback(err, null)
    }
    if (isSubset(existingPermissions, permissions)) {
      callback(null, node)
    }
    else {
      var err = new Error('Insufficent permissions')
      err.status_code = 403
      callback(err, null)
    }
  })
}

DatabaseAbstractionLayer.prototype.select = function(user, path, callback) {
  this.permissionsFor(user, path, function(err, permissions, node) {
    if (err) {
      callback(err, null)
      return
    }
    if (permissions.length === 0) {
      err = new Error('Insufficent permissions')
      err.status_code = 403
      callback(err, null)
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
    callback(null, result)
  });
}

DatabaseAbstractionLayer.prototype.list = function(user, path, callback) {
  var self = this
  self.authenticateFor(user, path, ['children-read'], function(err, node) {
    if (err)
      callback(err, null)
    else
      self.dbDriver.listChildren(path, callback)
  })
}

DatabaseAbstractionLayer.prototype.prepareNotifications = function(path, event) {
  var self = this
  var usersToNotify = []
  var fired = false
  var calculated = false
  self.dbDriver.getNodeWithParents(path, function(err, nodes) {
    if (err) {
      L.warn('An error occured when trying to determin notifications for created: ' + err)
      return
    }
    node = nodes[nodes.length - 1]
    usersToNotify = effectiveSubscriptions(nodes, event)
    L.debug('Notifications for event ' + event + ' on ' + path + ' go to ' + usersToNotify)
    if (fired)
      self.emit(event, usersToNotify, path)
    else
      calculated = true
  })
  return { fire: function() {
    if (calculated)
      self.emit(event, usersToNotify, path)
    else
      fired = true
  } }
}

DatabaseAbstractionLayer.prototype.create = function(user, path, content, callback) {
  var self = this
  var neededPermissions = ['children-write']
  for (key in content) {
    if (['data', 'acl', 'subscription'].indexOf(key) < 0) {
      var err = new Error('Tried to write to a non standart field');
      err.status_code = 422
      callback(err, null)
      return
    }
    else {
      neededPermissions.push(key+'-write')
    }
  }
  var parentPath = (new URI(path)).parent().toString();
  self.authenticateFor(user, parentPath, neededPermissions, function(err, node) {
    if (err) {
      callback(err, null)
      return
    }
    content.owner = user
    content.btime = moment().toISOString()
    content.mtime = moment().toISOString()
    self.dbDriver.setNode(path, content, callback)
    self.prepareNotifications(path, 'created').fire();
  });
}

DatabaseAbstractionLayer.prototype.update = function(user, path, content, callback) {
  var self = this
  var neededPermissions = []
  for (key in content) {
    if (['data', 'acl', 'subscriptions'].indexOf(key) < 0) {
      var err = new Error('Tried to write to a non standart field');
      err.status_code = 422
      callback(err, null)
      return
    }
    else {
      neededPermissions.push(key+'-write')
    }
  }
  self.authenticateFor(user, path, neededPermissions, function(err, node) {
    if (err) {
      callback(err, null)
      return
    }
    if (content.data)
      extend(true, node, { data: content.data })
    if (content.subscriptions)
      extend(true, node, { subscriptions: content.subscriptions })
    if (content.acl) {
      if (node.acl === null || typeof node.acl === 'undefined') {
        node.acl = content.acl
      }
      else {
        for (user in content.acl) {
          if (typeof node.acl[user] === 'undefined' || node.acl[user] === null) {
            node.acl[user] = content.acl[user]
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
    content.mtime = moment().toISOString()
    self.dbDriver.updateNode(path, node, callback)
    self.prepareNotifications(path, 'updated').fire();
  });
}

DatabaseAbstractionLayer.prototype.delete = function(user, path, callback) {
  var self = this
  var uri = new URI(path)
  if (uri.isRoot()) {
    var err = new Error('Cannot delete root node')
    err.status_code = 403
    callback(err)
    return
  }
  var parentPath = uri.parent().toString()
  self.authenticateFor(user, parentPath, ['children-delete'], function(err, node) {
    if (err) {
      callback(err)
      return
    }
    var notifications  = self.prepareNotifications(path, 'deleted');
    self.dbDriver.deleteNode(path, function(err) {
      if (err)
        callback(err)
      callback(null)
      notifications.fire()
    })
  })
}

DatabaseAbstractionLayer.prototype.addUser = function(name, domain, password, callback) {
  this.dbDriver.addUser(name, domain, password, function(err) {
    if (err)
      callback(err)
    else
      callback(null)
  })
}

DatabaseAbstractionLayer.prototype.authenticateUser = function(name, password, callback) {
  this.dbDriver.authenticateUser(name, password, function(err) {
    if (err)
      callback(err)
    else
      callback(null)
  })
}

module.exports = DatabaseAbstractionLayer;
