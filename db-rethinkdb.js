var r = require('rethinkdb');
var sys = require('sys');
var extend = require('extend');
var fosp = require('./fosp');
var connection = null;
var db = r.db('fosp');

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
  var path = uri.path;
  r.db('fosp').table(uri.user.name).filter(r.row('path').eq(path)).run(connection, function(err, cursor) {
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

var getAllNodes = function(path, callback) {
  var uri = new fosp.URI(path);
  var path = uri.path;
  if (path === "")
    path = ""
  r.db('fosp').table(uri.user.name).filter(function(node) { return r.expr('^'+path).match(node('path')); }).run(connection, callback);
}

module.exports = {
  getNode: getNode,
  setNode: setNode,
  updateNode: updateNode,
  deleteNode: deleteNode,
  getAllNodes: getAllNodes
}
