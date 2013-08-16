//var r = require('rethinkdb');
var fosp = require('./fosp');
var AuthenticatorMiddleware = require('./fosp/mw-asyncauthenticator');
var RemoteDomainRouter = require('./fosp/mw-remote-domain-router');
var options = { port: 1337, local_domain: 'mighty-maufl.localdomain' };
var dbOptions = { host: 'mighty-maufl.localdomain', port: 28015, db: 'fosp' };
var db = require('./db-rethinkdb');

var server = new fosp.Server(options);

console.log('Sever startet');

server.on('connection', function(con) {
  log('Recieved a new connection: ' + con.id);

  con.on('close', function() {
    log('Closing connection: ' + con.id);
  });
});

var auth = new AuthenticatorMiddleware(function(name, password, callback) {
  db.authenticateUser(name, password, function(failed) {
    var success = failed ? false : true;
    callback(success);
  });
});
console.log('Add authentication middleware');
server.middlewareStack.push(auth);

var rdr = new RemoteDomainRouter(server);
server.middlewareStack.push(rdr);

server.on('register', function(con, req) {
  if (!isNegotiated(con, req))
    return;
  db.addUser(req.body.name, req.body.password, function(failed) {
    if (failed)
      req.sendFailed(500);
    else
      req.sendSucceded(200);
  });
});
server.on('select', function(con, req) {
  if (!isAuthenticated(con, req))
    return;
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
  if (!isAuthenticated(con, req))
    return;
  db.setNode(req.uri.toString(), req.body, function(err, result) {
    if (err)
      req.sendFailed(500, {}, err);
    else
      req.sendSucceded(201);
  });
});
server.on('update', function(con, req) {
  if (!isAuthenticated(con, req))
    return;
  db.updateNode(req.uri.toString(), req.body, function(err, result) {
    if (err)
      req.sendFailed(500, {}, err);
    else
      req.sendSucceded(200);
  });
});
server.on('delete', function(con, req) {
  if (!isAuthenticated(con, req))
    return;
  db.deleteNode(req.uri.toString(), function(err) {
    if (err)
      req.sendFailed(500);
    else
      req.sendSucceded(200);
  });
});
server.on('list', function(con, req) {
  if (!isAuthenticated(con, req))
    return;
  db.listChildren(req.uri.toString(), function(err, children) {
    if (err)
      req.sendFailed(500);
    else
      req.sendSucceded(200, {}, children);
  });
});

var isNegotiated = function(con, req) {
  if (con.ctx.negotiated)
    return true;
  log('Connection is not yet negotiated');
  req.sendFailed(402);
  con.close();
  return false;
}

var isAuthenticated = function(con, req) {
  if (con.ctx.negotiated && con.ctx.authenticated)
    return true;
  log('Connection is not yet authenticated');
  req.sendFailed(402);
  con.close();
  return false;
}

var log = function(text) {
  console.log("example-server: " + text);
}
