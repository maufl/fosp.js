//var r = require('rethinkdb');
var fs = require('fs');
var fosp = require('./fosp');
var AuthenticatorMiddleware = require('./fosp/mw-async-user-authenticator');
var RemoteDomainRouter = require('./fosp/mw-remote-domain-router');
var RethinkDB = require('./db-rethinkdb');
var L = require('./fosp/logger').forFile(__filename);

var options = JSON.parse(fs.readFileSync('server.conf'));
var server = new fosp.Server(options);
var db = new RethinkDB(options.db);

L.info('Sever startet');

server.on('connection', function(con) {
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
  db.addUser(req.body.name, req.body.password, function(failed) {
    if (failed)
      req.sendFailed(500);
    else
      req.sendSucceded(200);
  });
});
server.on('select', function(con, req) {
  db.getNode(req.uri.toString(), function(err, result) {
    if (err)
      req.sendFailed(500, {}, "Failed to retrieve data\n" + err);
    else if (result === null)
      req.sendFailed(404, {}, "Not found");
    else
      req.sendSucceded(200, {}, result);
  });
});
server.on('create', function(con, req) {
  db.setNode(req.uri.toString(), req.body, function(err, result) {
    if (err)
      req.sendFailed(500, {}, err);
    else
      req.sendSucceded(201);
  });
});
server.on('update', function(con, req) {
  db.updateNode(req.uri.toString(), req.body, function(err, result) {
    if (err)
      req.sendFailed(500, {}, err);
    else
      req.sendSucceded(200);
  });
});
server.on('delete', function(con, req) {
  db.deleteNode(req.uri.toString(), function(err) {
    if (err)
      req.sendFailed(500);
    else
      req.sendSucceded(200);
  });
});
server.on('list', function(con, req) {
  db.listChildren(req.uri.toString(), function(err, children) {
    if (err)
      req.sendFailed(500);
    else
      req.sendSucceded(200, {}, children);
  });
});
