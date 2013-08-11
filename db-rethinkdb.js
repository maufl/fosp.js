var r = require('rethinkdb');
var fosp = require('./fosp');
var connection = null;

var log = function(text) {
  console.log("db: " + text);
}

r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
  if (err) throw err;
  connection = conn;
});

var getNode = function(path, callback) {
  var uri = new fosp.URI(path);
  var path = uri.path;
  if (path === "")
    path = "/"
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
            callback(null, result[0].content);
          }
        }
      });
  });
}

var getAllNodes = function(path, callback) {
  var uri = new fosp.URI(path);
  var path = uri.path;
  if (path === "")
    path = ""
  r.db('fosp').table(uri.user.name).filter(function(node) { return r.expr('$'+path).match(node('path')); }).run(connection, callback);
}

module.exports = {
  getNode: getNode,
  getAllNodes: getAllNodes
}
