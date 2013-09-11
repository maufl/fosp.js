//Translation between request and database layer happen here, should maybe be moved to middleware?
var L = require('../logger').forFile(__filename);

var RequestHandler = function(server) {
  var self = this
  this.server = server

  self.server.on('register', function(con, req) {
    self.server.db.addUser(req.body.name, self.server.local_domain, req.body.password, function(err) {
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
      user = req.con.remote + '@' + self.server.local_domain
    return user
  }

  self.server.on('select', function(con, req) {
    self.server.db.select(getUser(req), req.uri.toString(), function(err, result) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceded(200, {}, result);
    });
  });
  self.server.on('create', function(con, req) {
    self.server.db.create(getUser(req), req.uri.toString(), req.body, function(err, result) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceded(201);
    });
  });
  self.server.on('update', function(con, req) {
    self.server.db.update(getUser(req), req.uri.toString(), req.body, function(err, result) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceded(204);
    });
  });
  self.server.on('delete', function(con, req) {
    self.server.db.delete(getUser(req), req.uri.toString(), function(err) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceded(204);
    });
  });
  self.server.on('list', function(con, req) {
    self.server.db.list(getUser(req), req.uri.toString(), function(err, children) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceded(200, {}, children);
    });
  });
  self.server.on('read', function(con, req) {
    self.server.db.readAttachment(getUser(req), req.uri.toString(), function(err, buffer) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message)
      else
        req.sendSucceded(200, {}, buffer)
    })
  })
  self.server.on('write', function(con, req) {
    self.server.db.writeAttachment(getUser(req), req.uri.toString(), req.body, function(err) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message)
      else
        req.sendSucceded(204)
    })
  })
}

module.exports = RequestHandler
