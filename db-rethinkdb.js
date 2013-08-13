var r = require('rethinkdb');
var sys = require('sys');
var extend = require('extend');
var fosp = require('./fosp');
var connection = null;
var db = r.db('fosp');
var user_db = r.db('fosp_user');
var user_table = user_db.table('users');

var log = function(text) {
  console.log("db: " + text);
}

r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
  if (err) throw err;
  connection = conn;
});

var testNode = function(path, callback) {
  var uri = new fosp.URI(path);
  db.table(uri.user.name).filter({path: uri.path}).count().run(connection, function(err, num) {
    if (err || num !== 1)
      callback(false)
    else
      callback(true)
  });
}

var _getNode = function(path, callback) {
  var uri = new fosp.URI(path);
  r.db('fosp').table(uri.user.name).filter(r.row('path').eq(uri.path)).run(connection, function(err, cursor) {
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

var getNode = function(path, callback) {
  _getNode(path, function(err, result) {
    if (result)
      callback(null, result.content)
    else
      callback(err, null)
  });
}

var setNode = function(path, content, callback) {
  console.log(path);
  var uri = new fosp.URI(path);
  var pA = uri.path.split('/');
  pA.pop();
  var parentPath = pA.join('/');
  console.log("Parent is " + parentPath);
  getNode(uri.fqUser() + parentPath, function(err, result) {
    if (result)
      r.db('fosp').table(uri.user.name).insert({path: uri.path, content: content}).run(connection, function(err, result) {
        callback(err);
      });
    else
      callback("Precondition failed")
  });
}

var updateNode = function(path, content, callback) {
  var uri = new fosp.URI(path);
  _getNode(path, function(err, node) {
    if (node) {
      log("Before: " + JSON.stringify(node))
      extend(true, node, { content: content });
      log("After: " + JSON.stringify(node))
      db.table(uri.user.name).filter(r.row('path').eq(uri.path)).update(node).run(connection, function(err, result) {
        callback(err)
      });
    }
    else {
      callback("Precondition failed")
    }
  });
}

var deleteNode = function(path, callback) {
  var uri = new fosp.URI(path)
  if (uri.path === '/') {
    callback('Can not delete root');
    return;
  }
  db.table(uri.user.name).filter(r.row('path').match('^'+uri.path)).delete().run(connection, callback);
}

var listChildren = function(path, callback) {
  var uri = new fosp.URI(path)
  path = uri.path
  if (path === '/')
    path = ''
  db.table(uri.user.name).filter(r.row('path').match('^'+path+'/[^/]+$')).run(connection, function(err, cursor) {
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


var getAllNodes = function(path, callback) {
  var uri = new fosp.URI(path);
  var path = uri.path;
  if (path === "")
    path = ""
  r.db('fosp').table(uri.user.name).filter(function(node) { return r.expr('^'+path).match(node('path')); }).run(connection, callback);
}

var isUser = function(name, callback) {
  user_table.filter({name: name}).count().run(connection, function(err, num) {
    if (err || num < 1)
      callback(false)
    else
      callback(true)
  });
}

var addUser = function(name, password, callback) {
  isUser(name, function(exists) {
    if (exists) {
      callback("User already exists")
      return;
    }
    db.tableCreate(name).run(connection, function(err, object) {
      if (err) {
        callback(err);
        return;
      }
      db.table(name).insert({path: '/', content: 'Welcome home'}).run(connection, function(err, result) {
        if (err) {
          callback(err);
          return;
        }
        user_table.insert({name: name, password: password}).run(connection, function(err, result) {
          callback(err)
        });
      });
    });
  });
}

var authenticateUser = function(name, password, callback) {
  user_table.filter({name: name}).run(connection, function(err, cursor) {
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

module.exports = {
  getNode: getNode,
  setNode: setNode,
  updateNode: updateNode,
  deleteNode: deleteNode,
  listChildren: listChildren,
  getAllNodes: getAllNodes,
  addUser: addUser,
  authenticateUser: authenticateUser
}
