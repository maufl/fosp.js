//var r = require('rethinkdb');
var fosp = require('./fosp');
var options = { port: 1337, domain: 'example.com' };
var dbOptions = { host: 'localhost', port: 28015, db: 'fosp' };
var db = require('./db-rethinkdb');

var server = new fosp.Server(options);

server.on('connection', function(con) {
  log('Recieved a new connection: ' + con.id);

  con.on('close', function() {
    log('Closing connection: ' + con.id);
  });
});

server.on('connect', function(con, msg) {
  if (msg.body.version === "0.1") {
    con.ctx.negotiated = true;
    con.sendSucceded(100, msg.seq);
    return;
  }
  con.sendFailed(400, msg.seq);
});
server.on('authenticate', function(con, msg) {
  if (!isNegotiated(con, msg))
    return;
  db.authenticateUser(msg.body.name, msg.body.password, function(failed) {
    if (failed) {
      con.sendFailed(402, msg.seq);
      return;
    }
    con.ctx.authenticated = true;
    con.sendSucceded(210, msg.seq);
  });
});
server.on('register', function(con, msg) {
  if (!isNegotiated(con, msg))
    return;
  db.addUser(msg.body.name, msg.body.password, function(failed) {
    if (failed)
      con.sendFailed(500, msg.seq);
    else
      con.sendSucceded(200, msg.seq);
  });
});
server.on('select', function(con, msg) {
  if (!isAuthenticated(con, msg))
    return;
  db.getNode(msg.uri.toString(), function(err, result) {
    if (err)
      con.sendFailed(500, msg.seq, {}, "Failed to retrieve data\n" + err);
    else if (result === null)
      con.sendFailed(404, msg.seq, {}, "Not found");
    else
      con.sendSucceded(200, msg.seq, {}, result);
  });
});
server.on('create', function(con, msg) {
  if (!isAuthenticated(con, msg))
    return;
  db.setNode(msg.uri.toString(), msg.body, function(err, result) {
    if (err)
      con.sendFailed(500, msg.seq, {}, err);
    else
      con.sendSucceded(201, msg.seq);
  });
});
server.on('update', function(con, msg) {
  if (!isAuthenticated(con, msg))
    return;
  db.updateNode(msg.uri.toString(), msg.body, function(err, result) {
    if (err)
      con.sendFailed(500, msg.seq, {}, err);
    else
      con.sendSucceded(200, msg.seq);
  });
});
server.on('delete', function(con, msg) {
  if (!isAuthenticated(con, msg))
    return;
  db.deleteNode(msg.uri.toString(), function(err) {
    if (err)
      con.sendFailed(500, msg.seq);
    else
      con.sendSucceded(200, msg.seq);
  });
});
server.on('list', function(con, msg) {
  if (!isAuthenticated(con, msg))
    return;
  db.listChildren(msg.uri.toString(), function(err, children) {
    if (err)
      con.sendFailed(500, msg.seq);
    else
      con.sendSucceded(200, msg.seq, {}, children);
  });
});

var isNegotiated = function(con, msg) {
  if (con.ctx.negotiated)
    return true;
  log('Connection is not yet negotiated');
  con.sendFailed(402, msg.seq);
  con.close();
  return false;
}

var isAuthenticated = function(con, msg) {
  if (con.ctx.negotiated && con.ctx.authenticated)
    return true;
  log('Connection is not yet authenticated');
  con.sendFailed(402, msg.seq);
  con.close();
  return false;
}

var log = function(text) {
  console.log("example-server: " + text);
}
