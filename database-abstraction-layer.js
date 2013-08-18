// do all database stuff here
var moment = require('moment')
var URI = require('./fosp/uri')

var DatabaseAbstractionLayer = function(dbDriver) {
  var self = this
  self.dbDriver = dbDriver

}

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
    if (permissions.indexOf('subscription-read') >= 0)
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
  });
}

DatabaseAbstractionLayer.prototype.update = function(user, path, content, callback) {
  var self = this
  var neededPermissions = []
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
  self.authenticateFor(user, path, neededPermissions, function(err, node) {
    if (err) {
      callback(err, null)
      return
    }
    content.mtime = moment().toISOString()
    self.dbDriver.updateNode(path, content, callback)
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
    self.dbDriver.deleteNode(path, function(err) {
      if (err)
        callback(err)
      callback(null)
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
