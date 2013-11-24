//Translation between request and database layer happen here, should maybe be moved to middleware?
var L = require('../logger').forFile(__filename);
var P = require('../performance')

var RequestHandler = function(server) {
  var self = this
  this.server = server

  self.server.on('register', function(con, req) {
    if (typeof req.body.name === 'undefined' || typeof req.body.password === 'undefined') {
      req.sendFailed(400, {}, 'Name or password is missing')
      return
    }
    self.server.db.addUser(req.body.name, self.server.local_domain, req.body.password, function(err) {
      if (err) {
        L.warn('Registration failed: ' + err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      }
      else {
        L.info('Registration of ' + req.body.name + ' successfull')
        req.sendSucceeded(200);
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
    self.server.db.select(getUser(req), req.uri, function(err, result) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceeded(200, {}, result);
    });
  });
  self.server.on('create', function(con, req) {
    self.server.db.create(getUser(req), req.uri, req.body, function(err, result) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceeded(201);
      L.debug('Done with create request')
    });
  });
  self.server.on('update', function(con, req) {
    P.log('Entering RequestHandler for update')
    self.server.db.update(getUser(req), req.uri, req.body, function(err, result) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceeded(204);

      P.log('Leaving RequestHandler for update')
    });
  });
  self.server.on('delete', function(con, req) {
    self.server.db.delete(getUser(req), req.uri, function(err) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceeded(204);
    });
  });
  self.server.on('list', function(con, req) {
    self.server.db.list(getUser(req), req.uri, function(err, children) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message);
      else
        req.sendSucceeded(200, {}, children);
    });
  });
  self.server.on('read', function(con, req) {
    self.server.db.readAttachment(getUser(req), req.uri, function(err, buffer) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message)
      else
        req.sendSucceeded(200, {}, buffer)
    })
  })
  self.server.on('write', function(con, req) {
    self.server.db.writeAttachment(getUser(req), req.uri, req.body, function(err) {
      if (err)
        req.sendFailed(err.status_code || 500, {}, err.message)
      else
        req.sendSucceeded(204)
    })
  })
}

module.exports = RequestHandler
