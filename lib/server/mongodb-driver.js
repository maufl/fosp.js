// Driver for using mongodb as storage
var MongoClient = require('mongodb')
var fs = require('fs')
var path = require('path')
var extend = require('extend');
var moment = require('moment')
var Q = require('q')
var fosp = require('../fosp');
var DAL = require('./database-abstraction-layer')
var P = require('../performance')
var L = require('../logger').forFile(__filename);
L.transports.console.level = 'debug'

var db_error = function(err) {
  L.error('Database error occured: ' + err.message)
  L.error(err.stack)
  return new DAL.DatabaseError()
}

var MongodbDriver = function(options) {
  var self = this;
  self.options = options;
  self.host = options.host;
  self.port = options.port;
  self.user_collection = null
  self.data_collection = null
  self.db = null

  MongoClient.connect("mongodb://"+self.host+":"+self.port+"/"+self.options.db, function(err, db) {
    if (err) {
      L.error('Unable to connect to the rethinkdb host at ' + self.host + ':' + self.port)
      throw err;
    }
    self.db = db
    L.info('Successfully connected to the mongodb database on ' + self.host + ':' + self.port + ' db ' + options.db)
    L.info('Using collection ' + options.dataTable + ' for data and ' + options.userTable + ' for users')
    self.setup()
  });
}

MongodbDriver.prototype.setup = function() {
  var self = this
  self.user_collection = self.db.collection(self.options.userTable)
  self.data_collection = self.db.collection(self.options.dataTable)
  return Q.invoke(self.data_collection, 'ensureIndex', { uri: 'hashed' }, { unique: true }).then(function() {
    return Q.invoke(self.data_collection, 'ensureIndex', { parent_id: 1 })
  }).catch(function(err) {
    L.error('Error while setting up database')
    L.error(err.stack)
  })
}

// TODO
MongodbDriver.prototype.nodeExists = function(uri) {
  var self = this
  return Q.invoke(self.data_collection, 'findOne', { uri: uri.toString() }).then(function(doc) {
    if (doc === null || (doc instanceof Array && doc.length === 0))
      return Q.reject(new Error('Node not found'))
    else
      return Q(doc)
  })
}

MongodbDriver.prototype.__nodeExists = function(uri) {
  return Q.invoke(self.data_collection, 'count', { uri: uri.toString() }).then(function(num) {
    if (num === 1)
      return Q(true)
    else if (num === 0)
      return Q(false)
    else
      return Q.reject(db_error('Inconsitent database! Node for uri ' + uri.toString() + ' exists multiple times!'))
  })
}

MongodbDriver.prototype.__getNode = function(uri) {
  return Q.invoke(this.data_collection, 'findOne', { uri: uri.toString() }).then(function(doc) {
    if (doc === null || (doc instanceof Array && doc.length === 0))
      return Q.reject(db_error('Node not found'))
    else
      return Q(doc)
  })
}

//TODO
MongodbDriver.prototype.getNodeWithParents = function(uri) {
  var self = this
  var pathA = []
  while (! uri.isRoot() )
    pathA.push(uri.toString())
  pathA.push(uri.toString())

  return Q.invoke(self.data_collection, 'find', {uri: { $in: pathA }}).then(function(docs) {
    if (docs.length === pathA.length)
      return Q(docs)
    else
      return Q.reject(new Error('Node not found'))
  })
}

//TODO
MongodbDriver.prototype.create = function(uri, content) {
  var self = this
  return self.__getNode.then(function(node) {
    return Q.invoke(self.data_collection, 'insert', { uri: uri.toString(), parent_id: node._id, content: content })
  })
}

//TODO
MongodbDriver.prototype.update = function(uri, content) {
  return Q.invoke(this.data_collection, 'update', { $set: { content: content }})
}

//TODO
MongodbDriver.prototype.delete = function(uri) {
  if (uri.isRoot())
    return Q.reject(new Error('Cannot delete root node!'))
  return Q.invoke(this.data_collection, 'remove', { uri: { $regex: '^'+uri.toString() }})
}

//TODO
MongodbDriver.prototype.listChildren = function(uri) {
  var self = this
  return self.__getNode(uri).then(function(doc) {
    return Q.invoke(self.data_collection, 'find', { parent_id: doc._id }).then(function(docs) {
      var children = []
      for (var i=0; i<docs.length; i++) {
        children.push(docs[i].split('/').pop())
      }
      return Q(children)
    })
  })
}

//TODO
MongodbDriver.prototype.userExists = function(name) {
  return Q.ninvoke(this.user_collection, 'count', { name: name }).then(function(num) {
    if (num === 1)
      return Q(true)
    else
      return Q(false)
  })
}

//TODO
MongodbDriver.prototype.addUser = function(name, domain, password) {
  var self = this
  return self.userExists().then(function(exists) {
    if (exists)
      return Q.reject(new Error('User already exists'))
    var node = { uri: name+'@'+domain+'/', content: { owner: name+'@'+domain, btime: moment().toISOString(), mtime: moment().toISOString(), acl: {}, data: "Welcome home" } }
    node.content.acl[name+'@'+domain] = ['data-read', 'data-write', 'acl-read', 'acl-write', 'subscriptions-read', 'subscriptions-write', 'children-read', 'children-write', 'children-delete', 'attachment-read', 'attachment-write']
    return Q.invoke(self.data_collection, 'insert', node).then(function() {
      return Q.invoke(self.user_collection, 'insert', { name: name, password: password })
    })
  }).catch(function(err) {
    L.error('Error when adding new user')
    L.error(err.stack)
    return Q.reject(err)
  })
}

//TODO
MongodbDriver.prototype.authenticateUser = function(name, password) {
  return Q.invoke(self.user_collection, 'findOne', { name: name }).then(function(user) {
    if (user.password === password)
      return Q(null)
    return Q.reject(new Error('Password did not match'))
  })
}

//TODO
MongodbDriver.prototype.writeAttachment = function(uri, buffer) {}

//TODO
MongodbDriver.prototype.readAttachment = function(uri) {}

module.exports = MongodbDriver
