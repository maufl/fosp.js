//Translation between request and database layer happen here, should maybe be moved to middleware?
var L = require('../logger').forFile(__filename);

var RequestHandler = function(server) {
  this.server = server

  this.server.on('register', function(con, req) {
    this.server.db.addUser(req.body.name, this.server.local_domain, req.body.password, function(err) {
      if (err) {
        L.warn('Registration failed: ' + err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      }
      else {
        L.info('Registration of ' + req.body.name + ' successfull')
        req.sendSucceded(200);
      }
    });
  });

  var getUser = function(req) {
    var user = null
    if (req.con.type === 'server')
      user = req.headers['User'] + '@' + req.con.remote
    if (req.con.type === 'client')
      user = req.con.remote + '@' + this.server.local_domain
    return user
  }

  this.server.on('select', function(con, req) {
    this.server.db.select(getUser(req), req.uri.toString(), function(err, result) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.toString());
      else
        req.sendSucceded(200, {}, result);
    });
  });
  this.server.on('create', function(con, req) {
    this.server.db.create(getUser(req), req.uri.toString(), req.body, function(err, result) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.toString());
      else
        req.sendSucceded(201);
    });
  });
  this.server.on('update', function(con, req) {
    this.server.db.update(getUser(req), req.uri.toString(), req.body, function(err, result) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.toString());
      else
        req.sendSucceded(204);
    });
  });
  this.server.on('delete', function(con, req) {
    this.server.db.delete(getUser(req), req.uri.toString(), function(err) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.toString());
      else
        req.sendSucceded(204);
    });
  });
  this.server.on('list', function(con, req) {
    this.server.db.list(getUser(req), req.uri.toString(), function(err, children) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.toString());
      else
        req.sendSucceded(200, {}, children);
    });
  });
}

module.exports = RequestHandler
