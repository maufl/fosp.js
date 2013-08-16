var r = require('rethinkdb');
var extend = require('extend');
var fosp = require('./fosp');

var log = function(text) {
  console.log("db: " + text);
}
var RethinkDB = function(options) {
  var self = this;
  self.host = options.host;
  self.port = options.port;
  self.user_db = r.db(options.userDB);
  self.user_table = self.user_db.table(options.userTable);
  self.db = r.db(options.dataDB);
  self.connection = null;

  r.connect( {host: self.host, port: self.port}, function(err, conn) {
    if (err) throw err;
    self.connection = conn;
  });
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
      extend(true, node, { content: content });
      self.db.table(uri.user.name).filter(r.row('path').eq(uri.path)).update(node).run(self.connection, function(err, result) {
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
      callback(err, null)
    else
      cursor.toArray(function(err, result) {
        if (err) {
          callback(err, null);
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


RethinkDB.prototype.getAllNodes = function(path, callback) {
  var self = this;
  var uri = new fosp.URI(path);
  var path = uri.path;
  if (path === "")
    path = ""
  self.db.table(uri.user.name).filter(function(node) { return r.expr('^'+path).match(node('path')); }).run(self.connection, callback);
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

RethinkDB.prototype.addUser = function(name, password, callback) {
  var self = this;
  self.isUser(name, function(exists) {
    if (exists) {
      callback("User already exists")
      return;
    }
    self.db.tableCreate(name).run(self.connection, function(err, object) {
      if (err) {
        callback(err);
        return;
      }
      self.db.table(name).insert({path: '/', content: 'Welcome home'}).run(self.connection, function(err, result) {
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
      else {
        callback("Failed to authenticate");
      }
    });
  });
}

module.exports = RethinkDB;
