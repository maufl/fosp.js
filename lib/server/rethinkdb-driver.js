// DB layer
var r = require('rethinkdb');
var fs = require('fs')
var path = require('path')
var extend = require('extend');
var moment = require('moment')
var Q = require('q')
var fosp = require('../fosp');
var DAL = require('./database-abstraction-layer')
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
  self.user_db = r.db(options.userDB);
  self.user_table = self.user_db.table(options.userTable);
  self.db = r.db(options.dataDB);
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
    L.info('Successfully connected to the rethinkdb database on ' + self.host + ':' + self.port)
    L.info('Using db ' + options.dataDB + ' for data and ' + options.userDB + ' for users')
    self.makeDBAndTables()
  });
}

RethinkDB.prototype.makeDBAndTables = function() {
  var self = this
  var makeUserTable = function () {
    self.user_db.tableCreate(self.options.userTable).run(self.connection, function(err, result) {
      if (err)
        exitOnError(err)
      if (result.created !== 1) {
        L.error('Failed to create table for users!')
        process.exit(1)
      }
    })
  }
  var exitOnError = function(err) {
    L.error('Error while setting up databases and tables: ' + err)
    process.exit(1)
  }
  try {
  r.dbList().run(self.connection, function(err, list) {
    if (err)
      exitOnError(err)
    if (list.indexOf(self.options.dataDB) < 0) {
      L.info('Rethinkdb database for data does not exist, creating a new one')
      r.dbCreate(self.options.dataDB).run(self.connection, function(err, result) {
        if (err)
          exitOnError(err)
        if (result.created !== 1) {
          L.error('Failed to create database for data!')
          process.exit(1)
        }
      })
    }
    if (list.indexOf(self.options.userDB) < 0) {
      L.info('Rethinkdb database for users does not exist, creating a new one')
      r.dbCreate(self.options.userDB).run(self.connection, function(err, result) {
        if (err)
          exitOnError(err)
        if (result.created !== 1) {
          L.error('Failed to create database for users')
          process.exit(1)
        }
        makeUserTable()
      })
    }
    else {
      self.user_db.tableList().run(self.connection, function(err, list) {
        if (err)
          exitOnError(err)
        if (list.indexOf(self.options.userTable) < 0) {
          L.info('Rethinkdb table for users does not exist, creating a new one')
          makeUserTable()
        }
      })
    }
  })
  }
  catch (err) {
    exitOnError(err)
  }
}

RethinkDB.prototype.nodeExists = function(path) {
  var self = this, uri = new fosp.URI(path), d = Q.defer()
  this.db.table(uri.user.name).filter({path: uri.path}).count().run(this.connection, function(err, num) {
    if (err) {
      d.reject(db_error())
    }
    else if (num !== 1) {
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

RethinkDB.prototype.createNode = function(path, content) {
  var self = this, d = Q.defer()
  var uri = new fosp.URI(path);
  var pA = uri.path.split('/');
  pA.pop();
  var parentPath = pA.join('/');
  self.nodeExists(uri.fqUser() + parentPath)
    .then(function() {
      self.db.table(uri.user.name).insert({path: uri.path, content: content}).run(self.connection, function(err, result) {
        if (err)
          d.reject(err)
        else
          d.resolve(null)
      })
    })
    .catch(function(err) {
      if (err.status_code === 404) {
        err = new Error('Parent node not present')
        err.status_code = 422
      }
      d.reject(err)
    })
  return d.promise
}

RethinkDB.prototype.updateNode = function(path, content) {
  var self = this, d = Q.defer()
  var uri = new fosp.URI(path);
  self.nodeExists(path)
    .then(function() {
      self.db.table(uri.user.name).filter(r.row('path').eq(uri.path)).update({content: content}).run(self.connection, function(err, result) {
        err ? d.reject(err) : d.resolve(null)
      })
    })
    .catch(function(err) {
      d.reject(err)
    })
  return d.promise
}

RethinkDB.prototype.deleteNode = function(path) {
  var self = this, d = Q.defer()
  var uri = new fosp.URI(path)
  if (uri.path === '/') {
    var err = new Error('Can not delete root')
    err.status_code = 403
    d.reject(err)
    return;
  }
  self.nodeExists(path)
    .then(function() {
      self.db.table(uri.user.name).filter(r.row('path').match('^'+uri.path)).delete().run(self.connection, function(err) {
        err ? d.reject(err) : d.resolve(null)
      })
    })
    .catch(function(err) {
      d.reject(err)
    })
  return d.promise
}

RethinkDB.prototype.listChildren = function(path) {
  var self = this, d = Q.defer()
  var uri = new fosp.URI(path)
  path = uri.path
  if (path === '/')
    path = ''
  self.db.table(uri.user.name).filter(r.row('path').match('^'+path+'/[^/]+$')).run(self.connection, function(err, cursor) {
    if (err)
      d.reject(db_error())
    else
      cursor.toArray(function(err, result) {
        if (err) {
          d.reject(db_error())
        } else {
          var children = []
          for (var i=0; i< result.length; i++) {
            var pA = result[i].path.split('/');
            children.push(pA[pA.length - 1]);
          }
          d.resolve(children)
        }
      });
  })
  return d.promise
}


RethinkDB.prototype.getNodeWithParents = function(path) {
  var self = this, d = Q.defer()
  var uri = new fosp.URI(path);
  var path = uri.path;
  if (path === "")
    path = "/"
  self.db.table(uri.user.name).filter(r.js('(function(node) { return "' + path +'".match("^"+node.path); })')).orderBy('path').map(function(node){return node('content')}).run(self.connection, function(err, cursor){
    if (err) {
      d.reject(db_error(err))
    }
    else {
      cursor.toArray(function(err, array) {
        if (err)
          d.reject(db_error(err))
        else
          d.resolve(array)
      })
    }
  })
  return d.promise
}

RethinkDB.prototype.isUser = function(name) {
  var self = this, d = Q.defer()
  self.user_table.filter({name: name}).count().run(self.connection, function(err, num) {
    if (err)
      d.reject(db_error(err))
    else if (num !== 1)
      d.reject(new Error('User unknown'))
    else
      d.resolve()
  })
  return d.promise
}

RethinkDB.prototype.addUser = function(name, domain, password) {
  var self = this, d = Q.defer()
  self.isUser(name).then(function() {
      var err = new Error("User already exists")
      err.status_code = 409
      d.reject(err)
  }).catch(function(err) {
    if (err instanceof DAL.DatabaseError) {
      d.reject(err)
      return
    }
    self.db.tableCreate(name).run(self.connection, function(err, object) {
      if (err) {
        d.reject(err);
        return;
      }
      var node = { path: '/', content: { owner: name+'@'+domain, btime: moment().toISOString(), mtime: moment().toISOString(), acl: {}, data: "Welcome home" } }
      node.content.acl[name+'@'+domain] = ['data-read', 'data-write', 'acl-read', 'acl-write', 'subscriptions-read', 'subscriptions-write', 'children-read', 'children-write', 'children-delete', 'attachment-read', 'attachment-write']
      self.db.table(name).insert(node).run(self.connection, function(err, result) {
        if (err) {
          d.reject(err);
          return;
        }
        self.user_table.insert({name: name, password: password}).run(self.connection, function(err, result) {
          if (err)
            d.reject(err)
          else
            d.resolve()
        })
      })
    })
  })
  return d.promise
}

RethinkDB.prototype.authenticateUser = function(name, password) {
  var self = this, d = Q.defer()
  self.user_table.filter({name: name}).run(self.connection, function(err, cursor) {
    if (err) {
      d.reject(err);
      return;
    }
    cursor.toArray(function(err, users) {
      if (err) {
        d.reject(err);
        return;
      }
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
    });
  })
  return d.promise
}

RethinkDB.prototype.writeAttachment = function(resourceID, buffer) {
  var self = this, file_name = (new Buffer(resourceID)).toString('base64'), full_path = path.join(self.filestorage, file_name), d = Q.defer()
  fs.writeFile(full_path, buffer, {encoding: 'binary'}, function(err) {
    if (err) {
      L.error('Error while writing attachment for ' + resourceID + ' to the file storage at ' + full_path + ': ' + err)
      d.reject(new Error('Internal error while writing to attachment'))
    }
    d.resolve()
  })
  return d.promise
}

RethinkDB.prototype.readAttachment = function(resourceID) {
  var self = this, file_name = (new Buffer(resourceID)).toString('base64'), full_path = path.join(self.filestorage, file_name), d = Q.defer()
  fs.readFile(full_path, function(err, buffer) {
    if (err) {
      L.error('Error while reading attachment for ' + resourceID + ' from the file storage at ' + full_path + ': ' + err)
      d.reject(new Error('Internal error while reading attachment'))
    }
    d.resolve(buffer)
  })
  return d.promise
}

module.exports = RethinkDB;
