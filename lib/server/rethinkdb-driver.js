// DB layer
var r = require('rethinkdb');
var fs = require('fs')
var path = require('path')
var extend = require('extend');
var moment = require('moment')
var Q = require('q')
var fosp = require('../fosp');
var DAL = require('./database-abstraction-layer')
var P = require('../performance')
var L = require('../logger').forFile(__filename);

var db_error = function(err) {
  L.error('Database error occured: ' + err.message)
  L.error(err.stack)
  return new DAL.DatabaseError()
}

var RethinkDB = function(options) {
  var self = this;
  self.options = options;
  self.host = options.host;
  self.port = options.port;
  self.db = r.db(options.db);
  self.user_table = self.db.table(options.userTable);
  self.data_table = self.db.table(options.dataTable);
  self.connection = null;
  if (typeof options.filestorage !== 'string')
    throw new Error('Missing "filestorage" option for rethinkdb driver')
  self.filestorage = path.resolve(options.filestorage)
  if (!fs.existsSync(self.filestorage))
    throw new Error('Path ' + self.filestorage + ' for filestorage does not exist!')

  r.connect( {host: self.host, port: self.port}, function(err, conn) {
    if (err) {
      L.error('Unable to connect to the rethinkdb host at ' + self.host + ':' + self.port)
      throw err;
    }
    self.connection = conn;
    L.info('Successfully connected to the rethinkdb database on ' + self.host + ':' + self.port + ' db ' + options.db)
    L.info('Using table ' + options.dataTable + ' for data and ' + options.userTable + ' for users')
    self.setup()
  });
}

RethinkDB.prototype.makeDB = function() {
  return Q.ninvoke(r.dbCreate(this.options.db), 'run', this.connection)
}

RethinkDB.prototype.makeUserTable = function() {
  return Q.ninvoke(r.db(this.options.db).tableCreate(this.options.userTable, { cache_size: 32*1024*1024 }), 'run', this.connection)
}

RethinkDB.prototype.makeDataTable = function() {
  return Q.ninvoke(r.db(this.options.db).tableCreate(this.options.dataTable, { cache_size: 512*1024*1024 }), 'run', this.connection)
}

RethinkDB.prototype.makeDataTableIndex = function() {
  var self = this
  return Q.ninvoke(r.db(self.options.db).table(self.options.dataTable).indexCreate('uri'), 'run', self.connection)
}

RethinkDB.prototype.checkDB = function() {
  var self = this, d = Q.defer()
  r.dbList().run(self.connection, function(err, list) {
    if (err)
      d.reject(err)
    else if (list.indexOf(self.options.db) < 0)
      d.resolve(false)
    else
      d.resolve(true)
  })
  return d.promise
}

RethinkDB.prototype.checkTable = function(table) {
  var self = this, d = Q.defer()
  r.db(self.options.db).tableList().run(self.connection, function(err, list) {
    if (err)
      d.reject(err)
    else if (list.indexOf(table) < 0)
      d.resolve(false)
    else
      d.resolve(true)
  })
  return d.promise
}

RethinkDB.prototype.setup = function() {
  var self = this
  self.checkDB().then(function(exists) {
    if (! exists) {
      L.info('Database does not exist, creating a new one')
      return self.makeDB()
    }
    return Q()
  }).then(function() {
    return self.checkTable(self.options.userTable)
  }).then(function(exists) {
    if (! exists) {
      L.info('User table does not exist, creating a new one')
      return self.makeUserTable()
    }
    return Q()
  }).then(function() {
    return self.checkTable(self.options.dataTable)
  }).then(function(exists) {
    if (! exists) {
      L.info('Data table does not exist, creating a new one')
      return self.makeDataTable().then(function() { return self.makeDataTableIndex() })
    }
    return Q()
  }).catch(function(err) {
    L.error('Error while setting up database:')
    L.error(err)
    L.error(err.stack)
  })
}


RethinkDB.prototype.nodeExists = function(uri) {
  var self = this, d = Q.defer()
  Q.ninvoke(self.data_table.getAll(uri.toString(), { index: 'uri' }).count(), 'run', self.connection).then(function(num) {
    if (num !== 1) {
      var err = new Error("Node not found")
      err.status_code = 404
      d.reject(err)
    }
    else {
      d.resolve()
    }
  }).catch(function(err) {
    d.reject(db_error(err))
  })
  return d.promise
}

RethinkDB.prototype.__getNode = function(uri) {
  var self = this, d = Q.defer()
  Q.ninvoke(self.data_table.getAll(uri.toString(), { index: 'uri' }), 'run', self.connection).then(function(cursor) {
    cursor.toArray(function(err, result) {
      if (err)
        d.reject(err)
      if (result.length === 0) {
        var err = new Error('Node ' + uri.toString() + ' not found')
        err.status_code = 404
        d.reject(err)
      }
      else {
        d.resolve(result[0])
      }
    })
  }).catch(function(err) {
    d.reject(err)
  })
  return d.promise
}

RethinkDB.prototype.createNode = function(uri, content) {
  var self = this, d = Q.defer()
  self.__getNode(uri.parent()).then(function(node) {
    return Q.ninvoke(self.data_table.insert({ uri: uri.toString(), parent: node.id, content: content }), 'run', self.connection)
  }).then(function() {
    d.resolve()
  }).catch(function(err) {
    if (err.status_code === 404) {
      err = new Error('Parent node not present')
      err.status_code = 422
    }
    d.reject(err)
  })
  return d.promise
}

RethinkDB.prototype.updateNode = function(uri, content) {
  P.log('Entering RethinkDB.updateNode')
  var self = this
  return Q.ninvoke(self.data_table.getAll(uri.toString(), { index : 'uri' }).update({content: content}), 'run', self.connection)
}

RethinkDB.prototype.deleteNode = function(uri) {
  var self = this, d = Q.defer()
  if (uri.isRoot()) {
    var err = new Error('Can not delete root')
    err.status_code = 403
    d.reject(err)
    return;
  }
  d.resolve(self.nodeExists(uri).then(function() {
    return Q.ninvoke(self.data_table.filter(r.row('uri').match('^'+uri.toString())).delete(), 'run', self.connection)
  }))
  return d.promise
}

RethinkDB.prototype.listChildren = function(uri) {
  var self = this, d = Q.defer()
  self.__getNode(uri).then(function(node) {
    return Q.ninvoke(self.data_table.filter({ parent: node.id }), 'run', self.connection)
  }).then(function(cursor) {
    cursor.toArray(function(err, array) {
      if (err) {
        d.reject(db_error(err))
        return
      }
      var children = []
      for (var i=0; i< array.length; i++) {
        var pA = array[i].uri.split('/');
        children.push(pA[pA.length - 1]);
      }
      d.resolve(children)
      if (cursor.close) {
        L.info('Closing query cursor for list')
        cursor.close()
      }
    })
  }).catch(function(err) {
    d.reject(err)
  })
  return d.promise
}


RethinkDB.prototype.getNodeWithParents = function(uri) {
  var self = this, d = Q.defer()
  var args = []
  while (! uri.isRoot()) {
    args.push(uri.toString())
    uri = uri.parent()
  }
  args.push(uri.toString())
  args[args.length] = { index: 'uri' }

  var nodeWithParentsRelation = self.data_table.getAll.apply(self.data_table, args).orderBy('uri')
  P.log('Starting database query for nodeWithParents')
  nodeWithParentsRelation.run(self.connection, function(err, cursor) {
    P.log('Finished database query for nodeWithParents')
    if (err) {
      d.reject(db_error(err))
      return
    }
    var array = [], nodeExists = false
    P.log('Starting node iteration')
    while (cursor.hasNext()) {
      cursor.next(function(err, row) {
        if (err) {
          d.reject(db_error(err))
          return
        }
        array.push(row.content)
        if (uri.toString() === row.uri)
          nodeExists = true
      })
    }
    P.log('Finished node iteration')
    if (nodeExists) {
      d.resolve(array)
    }
    else {
      var err = new Error("Object not found")
      err.status_code = 404
      d.reject(err)
    }
    if (cursor.close) {
      L.info('Closing query cursor for node with parents')
      cursor.close()
    }
  })
  return d.promise
}

RethinkDB.prototype.userExists = function(name) {
  var self = this, d = Q.defer()
  L.info('Check existing user')
  Q.ninvoke(self.user_table.filter({name: name}).count(), 'run', self.connection).then(function(num) {
    if (num === 0)
      d.resolve(false)
    else
      d.resolve(true)
  }).catch(function(err) {
    d.reject(db_error(err))
  })
  return d.promise
}

RethinkDB.prototype.addUser = function(name, domain, password) {
  var self = this
  return self.userExists(name).then(function(exists) {
    if (exists) {
      var err = new Error("User already exists")
      err.status_code = 409
      return Q.reject(err)
    }
    var node = { uri: name+'@'+domain+'/', content: { owner: name+'@'+domain, btime: moment().toISOString(), mtime: moment().toISOString(), acl: {}, data: "Welcome home" } }
    node.content.acl[name+'@'+domain] = ['data-read', 'data-write', 'acl-read', 'acl-write', 'subscriptions-read', 'subscriptions-write', 'children-read', 'children-write', 'children-delete', 'attachment-read', 'attachment-write']
    return Q.ninvoke(self.data_table.insert(node), 'run', self.connection).then(function() {
      return Q.ninvoke(self.user_table.insert({name: name, password: password}), 'run', self.connection)
    })
  })
}

RethinkDB.prototype.authenticateUser = function(name, password) {
  var self = this, d = Q.defer()
  Q.ninvoke(self.user_table.filter({name: name}), 'run', self.connection).then(function(cursor) {
    return Q.ninvoke(cursor, 'toArray')
  }).then(function(users) {
    if (users.length === 1 && users[0].password === password) {
      d.resolve(null);
    }
    else if (users.length === 1) {
      var err = new Error("Password did not match")
      err.status_code = 401
      d.reject(err);
    }
    else if (users.length === 0) {
      var err = new Error("User not found")
      err.status_code = 404
      d.reject(err)
    }
    else {
      d.reject(new Error("Internal server error"))
    }
  }).catch(function(err) {
    d.reject(db_error(err))
  })
  return d.promise
}

// Attachment related functions

RethinkDB.prototype.determinAttachmentPath = function(resourceID) {
  var dirs = resourceID.split('/')
  if (dirs[dirs.length - 1] === '')
    dirs.pop()
  for (var i=0; i<dirs.length; i++) {
    dirs[i] = (new Buffer(dirs[i])).toString('base64')
  }
  return path.join(this.filestorage, dirs.join('/'))
}

var mkdirP = function(p) {
  var dirname = path.dirname(p), d = Q.defer()
  fs.exists(dirname, function(exists) {
    if (! exists) {
      mkdirP(dirname).then(function() {
        fs.mkdir(dirname, function(err) {
          if (err)
            d.reject(err)
          else
            d.resolve()
        })
      }).catch(function(err) {
        d.reject(err)
      })
    }
    else {
      d.resolve()
    }
  })
  return d.promise
}

RethinkDB.prototype.writeAttachment = function(uri, buffer) {
  console.log("Foo")
  var self = this, full_path = self.determinAttachmentPath(uri.toString()), d = Q.defer()
  console.log("Bar")
  mkdirP(full_path).then(function() {
    console.log('Writing file')
    return Q.nfcall(fs.writeFile, full_path, buffer, {encoding: 'binary'})
  }).then(function() {
    d.resolve()
  }).catch(function(err) {
    L.error('Error while writing attachment for ' + resourceID + ' to the file storage at ' + full_path + ': ' + err)
    d.reject(new Error('Internal error while writing to attachment'))
  })
  return d.promise
}

RethinkDB.prototype.readAttachment = function(uri) {
  var self = this, full_path = self.determinAttachmentPath(uri.toString()), d = Q.defer()
  mkdirP(full_path).then(function() {
    return Q.nfcall(fs.readFile, full_path)
  }).then(function(buffer) {
    d.resolve(buffer)
  }).catch(function(err) {
    L.error('Error while reading attachment for ' + resourceID + ' from the file storage at ' + full_path + ': ' + err)
  d.reject(new Error('Internal error while reading attachment'))
})
return d.promise
}

module.exports = RethinkDB;
