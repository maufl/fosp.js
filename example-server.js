//var r = require('rethinkdb');
var fosp = require('./fosp');
var Server = require('./fosp/server');
var options = { port: 1337, domain: 'example.com' };
var dbOptions = { host: 'localhost', port: 28015, db: 'fosp' };
var db = require('./db-rethinkdb');

var fospServer = new Server(options);

var log = function(text) {
  console.log("++ " + text);
}

fospServer.on('connection', function(con) {
  var conId = Math.floor(Math.random() * 10001);
  log('Recieved a new connection: ' + conId);
	con.on('message', function(msg) {
		log(conId + ' Recieved new message: ' + JSON.stringify(msg));
    log(msg.uri.toString());
	});
});

fospServer.on('request', function(con, msg) {
  switch(msg.request) {
    case 'SELECT':
      db.getNode(msg.uri.toString(), function(err, result) {
        log("Result " + result);
        if (err)
          con.sendMessage({type: fosp.RESPONSE, response: "FAILED", seq: msg.seq, status: 500, body: "Failed to retrieve data\n" + err});
        else if (result === null)
          con.sendMessage({type: fosp.RESPONSE, response: "FAILED", seq: msg.seq, status: 404, body: "Not found" });
        else
          con.sendMessage({type: fosp.RESPONSE, response: "SUCCEDED", seq: msg.seq, status: 200, body: result});
      });
      break;
    case 'CREATE':
      db.setNode(msg.uri.toString(), msg.body, function(err, result) {
        if (err)
          con.sendMessage({type: fosp.RESPONSE, response: "FAILED", seq: msg.seq, status: 500, body: err});
        else
          con.sendMessage({type: fosp.RESPONSE, response: "SUCCEDED", seq: msg.seq, status: 201, body: null});
      });
      break;
    case 'UPDATE':
      db.updateNode(msg.uri.toString(), msg.body, function(err, result) {
        if (err)
          con.sendMessage({type: fosp.RESPONSE, response: "FAILED", seq: msg.seq, status: 500, body: err});
        else
          con.sendMessage({type: fosp.RESPONSE, response: "SUCCEDED", seq: msg.seq, status: 200, body: null});
      });
      break;
    case 'DELETE':
      db.deleteNode(msg.uri.toString(), function(err) {
        if (err)
          con.sendMessage({type: fosp.RESPONSE, response: 'FAILED', seq: msg.seq, status: 500, body: null});
        else
          con.sendMessage({type: fosp.RESPONSE, response: "SUCCEDED", seq: msg.seq, status: 200, body: null});
      });
      break;
    case 'LIST':
      db.listChildren(msg.uri.toString(), function(err, children) {
        if (err)
          con.sendMessage({type: fosp.RESPONSE, response: 'FAILED', seq: msg.seq, status: 500, body: null});
        else
          con.sendMessage({type: fosp.RESPONSE, response: "SUCCEDED", seq: msg.seq, status: 200, body: children});
      });
      break;
    default:
      con.sendMessage({
        type: fosp.RESPONSE,
        response: "FAILED",
        status: 500,
        seq: msg.seq,
        body: "VERB not known"
      });
      break;
  }
});
