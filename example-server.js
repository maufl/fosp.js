//var r = require('rethinkdb');
var fosp = require('./fosp');
var Server = require('./fosp/server');
var options = { port: 1337, domain: 'example.com' };
var dbOptions = { host: 'localhost', port: 28015, db: 'fosp' };
var db = require('./db-rethinkdb');

var fospServer = new Server(options);

fospServer.on('connection', function(con) {
  log('Recieved a new connection: ' + con.id);
});

fospServer.on('connect', function(con, msg) {
  if (msg.body.version === "0.1")
    con.sendSucceded(100, msg.seq);
  else
    con.sendFailed(400, msg.seq);
});
fospServer.on('authenticate', function(con, msg) {
  db.authenticateUser(msg.body.name, msg.body.password, function(failed) {
    if (failed)
      con.sendFailed(402, msg.seq);
    else
      con.sendSucceded(210, msg.seq);
  });
});
fospServer.on('register', function(con, msg) {
  db.addUser(msg.body.name, msg.body.password, function(failed) {
    if (failed)
      con.sendFailed(500, msg.seq);
    else
      con.sendSucceded(200, msg.seq);
  });
});
fospServer.on('select', function(con, msg) {
  db.getNode(msg.uri.toString(), function(err, result) {
    if (err)
      con.sendFailed(500, msg.seq, {}, "Failed to retrieve data\n" + err);
    else if (result === null)
      con.sendFailed(404, msg.seq, {}, "Not found");
    else
      con.sendSucceded(200, msg.seq, {}, result);
  });
});
fospServer.on('create', function(con, msg) {
  db.setNode(msg.uri.toString(), msg.body, function(err, result) {
    if (err)
      con.sendFailed(500, msg.seq, {}, err);
    else
      con.sendSucceded(201, msg.seq);
  });
});
fospServer.on('update', function(con, msg) {
  db.updateNode(msg.uri.toString(), msg.body, function(err, result) {
    if (err)
      con.sendFailed(500, msg.seq, {}, err);
    else
      con.sendSucceded(200, msg.seq);
  });
});
fospServer.on('delete', function(con, msg) {
  db.deleteNode(msg.uri.toString(), function(err) {
    if (err)
      con.sendFailed(500, msg.seq);
    else
      con.sendSucceded(200, msg.seq);
  });
});
fospServer.on('list', function(con, msg) {
  db.listChildren(msg.uri.toString(), function(err, children) {
    if (err)
      con.sendFailed(500, msg.seq);
    else
      con.sendSucceded(200, msg.seq, {}, children);
  });
});

var log = function(text) {
  console.log("example-server: " + text);
}
