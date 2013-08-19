//var r = require('rethinkdb');
var fs = require('fs');
var fosp = require('./fosp');
var AuthenticatorMiddleware = require('./fosp/server/middleware/async-user-authenticator');
var RemoteDomainRouter = require('./fosp/server/middleware/remote-domain-router');
var RethinkDB = require('./fosp/server/rethinkdb-driver');
var DatabaseAbstractionLayer = require('./fosp/server/database-abstraction-layer');
var L = require('./fosp/logger').forFile(__filename);

var options = JSON.parse(fs.readFileSync('server.conf'));
var server = new fosp.Server(options);
var dbDriver = new RethinkDB(options.db);
var db = new DatabaseAbstractionLayer(dbDriver);

L.info('Sever startet');

server.on('connect', function(con) {
  L.info('Recieved a new connection: ' + con.id);

  con.on('close', function() {
    L.info('Closing connection: ' + con.id);
  });
});

var auth = new AuthenticatorMiddleware(function(name, password, callback) {
  db.authenticateUser(name, password, function(failed) {
    var success = failed ? false : true;
    callback(success);
  });
});
L.info('Add authentication middleware');
server.middlewareStack.push(auth);

var rdr = new RemoteDomainRouter(server);
server.middlewareStack.push(rdr);

server.on('register', function(con, req) {
  db.addUser(req.body.name, server.local_domain, req.body.password, function(failed) {
    if (failed)
      req.sendFailed(500);
    else
      req.sendSucceded(200);
  });
});

var getUser = function(req) {
  var user = null
  if (req.con.type === 'server')
    user = req.headers['User'] + '@' + req.con.remote
  if (req.con.type === 'client')
    user = req.con.remote + '@' + server.local_domain
  return user
}

server.on('select', function(con, req) {
  db.select(getUser(req), req.uri.toString(), function(err, result) {
    if (err)
      req.sendFailed(err.status_code || 500, {}, err.toString());
    else
      req.sendSucceded(200, {}, result);
  });
});
server.on('create', function(con, req) {
  db.create(getUser(req), req.uri.toString(), req.body, function(err, result) {
    if (err)
      req.sendFailed(err.status_code || 500, {}, err.toString());
    else
      req.sendSucceded(201);
  });
});
db.on('created', function(users, path) {
  L.info(path + ' was created, following users should be notified: ' + users)
  for (var i=0; i < users.length; i++) {
    var user = users[i]
    db.select(user, path, function(err, node) {
      if (err)
        return
      var name = user.substring(0, user.indexOf('@'))
      var domain = user.substring(user.indexOf('@') + 1, user.length)
      if (domain === server.local_domain) {
        var con = server.connectionPool.get(name)
        if (con)
          con.sendCreated(path, {}, node)
      }
      else {
        var con = server.connectionPool.get(domain)
        if (con)
          con.sendCreated(path, {User: name}, node)
      }
    })
  }
})
server.on('update', function(con, req) {
  db.update(getUser(req), req.uri.toString(), req.body, function(err, result) {
    if (err)
      req.sendFailed(err.status_code || 500, {}, err.toString());
    else
      req.sendSucceded(204);
  });
});
db.on('updated', function(users, path, node) {
  L.info(path + ' was updated, following users should be notified: ' + users)
  for (var i=0; i < users.length; i++) {
    var user = users[i]
    db.select(user, path, function(err, node) {
      if (err) {
        L.warn('Error occured when fetching node for update event: ' + err)
        return
      }
      var name = user.substring(0, user.indexOf('@'))
      var domain = user.substring(user.indexOf('@') + 1, user.length)
      L.info('Send update message to user ' + name + ' on ' + domain)
      if (domain === server.local_domain) {
        var con = server.connectionPool.get(name)
        if (con)
          con.sendUpdated(path, {}, node)
      }
      else {
        var con = server.connectionPool.get(domain)
        if (con)
          con.sendUpdated(path, {User: name}, node)
      }
    })
  }
})
server.on('delete', function(con, req) {
  db.delete(getUser(req), req.uri.toString(), function(err) {
    if (err)
      req.sendFailed(err.status_code || 500, {}, err.toString());
    else
      req.sendSucceded(204);
  });
});
db.on('deleted', function(users, path) {
  L.info(path + ' was deleted, following users should be notified: ' + users)
  for (var i=0; i < users.length; i++) {
    var user = users[i]
    var name = user.substring(0, user.indexOf('@'))
    var domain = user.substring(user.indexOf('@') + 1, user.length)
    if (domain === server.local_domain) {
      var con = server.connectionPool.get(name)
      if (con)
        con.sendDeleted(path)
    }
    else {
      var con = server.connectionPool.get(domain)
      if (con)
        con.sendDeleted(path, {User: name})
    }
  }
})
server.on('list', function(con, req) {
  db.list(getUser(req), req.uri.toString(), function(err, children) {
    if (err)
      req.sendFailed(err.status_code || 500, {}, err.toString());
    else
      req.sendSucceded(200, {}, children);
  });
});
