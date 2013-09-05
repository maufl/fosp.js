// DB layer
var r = require('rethinkdb');
var extend = require('extend');
var moment = require('moment')
var fosp = require('../fosp');
var L = require('../logger').forFile(__filename);

var RethinkDB = function(options) {
  var self = this;
  self.options = options;
  self.host = options.host;
  self.port = options.port;
  self.user_db = r.db(options.userDB);
  self.user_table = self.user_db.table(options.userTable);
  self.db = r.db(options.dataDB);
  self.connection = null;

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

RethinkDB.prototype.testNode = function(path, callback) {
  var uri = new fosp.URI(path);
  this.db.table(uri.user.name).filter({path: uri.path}).count().run(this.connection, function(err, num) {
    if (err || num !== 1)
      callback(false)
    else
      callback(true)
  });
}

RethinkDB.prototype._getNode = function(path, callback) {
  var uri = new fosp.URI(path);
  this.db.table(uri.user.name).filter(r.row('path').eq(uri.path)).run(this.connection, function(err, cursor) {
    if (err)
      callback(err, null);
    else
      cursor.toArray(function(err, result) {
        if (err) {
          callback(err, null);
        } else {
          if (result.length > 1) {
            callback("Database error", null);
          } else if (result.length === 0) {
            callback(null, null);
          } else {
            callback(null, result[0]);
          }
        }
      });
  });
}

RethinkDB.prototype.getNode = function(path, callback) {
  this._getNode(path, function(err, result) {
    if (result)
      callback(null, result.content)
    else
      callback(err, null)
  });
}

RethinkDB.prototype.setNode = function(path, content, callback) {
  var self = this;
  var uri = new fosp.URI(path);
  var pA = uri.path.split('/');
  pA.pop();
  var parentPath = pA.join('/');
  self.getNode(uri.fqUser() + parentPath, function(err, result) {
    if (result)
      self.db.table(uri.user.name).insert({path: uri.path, content: content}).run(self.connection, function(err, result) {
        callback(err);
      });
    else
      callback("Precondition failed")
  });
}

RethinkDB.prototype.updateNode = function(path, content, callback) {
  var self = this;
  var uri = new fosp.URI(path);
  self._getNode(path, function(err, node) {
    if (node) {
      self.db.table(uri.user.name).filter(r.row('path').eq(uri.path)).update({content: content}).run(self.connection, function(err, result) {
        callback(err)
      });
    }
    else {
      callback("Precondition failed")
    }
  });
}

RethinkDB.prototype.deleteNode = function(path, callback) {
  var self = this;
  var uri = new fosp.URI(path)
  if (uri.path === '/') {
    callback('Can not delete root');
    return;
  }
  self.db.table(uri.user.name).filter(r.row('path').match('^'+uri.path)).delete().run(self.connection, callback);
}

RethinkDB.prototype.listChildren = function(path, callback) {
  var self = this;
  var uri = new fosp.URI(path)
  path = uri.path
  if (path === '/')
    path = ''
  self.db.table(uri.user.name).filter(r.row('path').match('^'+path+'/[^/]+$')).run(self.connection, function(err, cursor) {
    if (err)
      callback(new Error('Database error'), null)
    else
      cursor.toArray(function(err, result) {
        if (err) {
          callback(new Error('Database error'), null);
        } else {
          var children = []
          for (var i=0; i< result.length; i++) {
            var pA = result[i].path.split('/');
            children.push(pA[pA.length - 1]);
          }
          callback(null, children)
        }
      });
  });
}


RethinkDB.prototype.getNodeWithParents = function(path, callback) {
  var self = this;
  var uri = new fosp.URI(path);
  var path = uri.path;
  if (path === "")
    path = "/"
  self.db.table(uri.user.name).filter(r.js('(function(node) { return "' + path +'".match("^"+node.path); })')).orderBy('path').map(function(node){return node('content')}).run(self.connection, function(err, cursor){
    if (err) {
      callback(new Error('Database error'), null)
    }
    else {
      cursor.toArray(function(err, array) {
        if (err)
          callback(new Error('Database error'), null)
        else
          callback(null, array)
      });
    }
  });
}

RethinkDB.prototype.isUser = function(name, callback) {
  var self = this;
  self.user_table.filter({name: name}).count().run(self.connection, function(err, num) {
    if (err || num < 1)
      callback(false)
    else
      callback(true)
  });
}

RethinkDB.prototype.addUser = function(name, domain, password, callback) {
  var self = this;
  self.isUser(name, function(exists) {
    if (exists) {
      var err = new Error("User already exists")
      err.status_code = 409
      callback(err)
      return;
    }
    self.db.tableCreate(name).run(self.connection, function(err, object) {
      if (err) {
        callback(err);
        return;
      }
      var node = { path: '/', content: { owner: name+'@'+domain, btime: moment().toISOString(), mtime: moment().toISOString(), acl: {}, data: "Welcome home" } }
      node.content.acl[name+'@'+domain] = ['data-read', 'data-write', 'acl-read', 'acl-write', 'subscriptions-read', 'subscriptions-write', 'children-read', 'children-write', 'children-delete']
      self.db.table(name).insert(node).run(self.connection, function(err, result) {
        if (err) {
          callback(err);
          return;
        }
        self.user_table.insert({name: name, password: password}).run(self.connection, function(err, result) {
          callback(err)
        });
      });
    });
  });
}

RethinkDB.prototype.authenticateUser = function(name, password, callback) {
  var self = this;
  self.user_table.filter({name: name}).run(self.connection, function(err, cursor) {
    if (err) {
      callback(err);
      return;
    }
    cursor.toArray(function(err, users) {
      if (err) {
        callback(err);
        return;
      }
      if (users.length === 1 && users[0].password === password) {
        callback(null);
      }
      else if (users.length === 1) {
        var err = new Error("Password did not match")
        err.status_code = 401
        callback(err);
      }
      else if (users.length === 0) {
        var err = new Error("User not found")
        err.status_code = 404
        callback(err)
      }
      else {
        callback(new Error("Internal server error"))
      }
    });
  });
}

module.exports = RethinkDB;
