//var r = require('rethinkdb');
var fs = require('fs');
var fosp = require('./fosp');
var AuthenticatorMiddleware = require('./fosp/mw-async-user-authenticator');
var RemoteDomainRouter = require('./fosp/mw-remote-domain-router');
var RethinkDB = require('./db-rethinkdb');
var DatabaseAbstractionLayer = require('./database-abstraction-layer');
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
server.on('update', function(con, req) {
  db.update(getUser(req), req.uri.toString(), req.body, function(err, result) {
    if (err)
      req.sendFailed(err.status_code || 500, {}, err.toString());
    else
      req.sendSucceded(204);
  });
});
server.on('delete', function(con, req) {
  db.delete(getUser(req), req.uri.toString(), function(err) {
    if (err)
      req.sendFailed(err.status_code || 500, {}, err.toString());
    else
      req.sendSucceded(204);
  });
});
server.on('list', function(con, req) {
  db.list(getUser(req), req.uri.toString(), function(err, children) {
    if (err)
      req.sendFailed(err.status_code || 500, {}, err.toString());
    else
      req.sendSucceded(200, {}, children);
  });
});
