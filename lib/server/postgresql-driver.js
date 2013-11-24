// Driver for using mongodb as storage
var pg = require('pg.js')//.native
var fs = require('fs')
var path = require('path')
var extend = require('extend');
var moment = require('moment')
var Q = require('q')
var U = require('util')
var fosp = require('../fosp');
var DAL = require('./database-abstraction-layer')
var P = require('../performance')
var L = require('../logger').forFile(__filename);
L.transports.console.level = 'debug'

var db_error = function(err) {
  L.error('Database error occured: ' + err.message)
  L.error(err.stack)
  return new DAL.DatabaseError()
}

var schema = "CREATE TABLE IF NOT EXISTS users ( \
    name varchar(256) unique, \
    password varchar(256) \
    ); \
CREATE TABLE IF NOT EXISTS data ( \
    id bigserial primary key, \
    uri text unique, \
    parent_id bigserial, \
    content text \
    );"

var PostgresqlDriver = function(options) {
  var self = this;
  self.options = options
  self.user = options.user
  self.password = options.password
  self.host = options.host
  self.port = options.port
  self.database = options.db
  self.user_table = options.userTable
  self.data_table = options.dataTable
  self.connectionString = "postgres://" + self.user + ":" + self.password + "@" + self.host + ":" + self. port + "/" + self.database
  self.client = new pg.Client(self.connectionString)
  self.client.connect()
  self.client.on('error', function(err) {
    L.error('Error in postgres client')
    L.error(err.stack)
  })
  self.client.on('drain', function() {
    L.info('Query queue drained')
  })
  self.client.on('notice', function(msg) {
    L.info('Notice from pg server: ' + msg)
  })
  self.client.query('SET AUTOCOMMIT TO ON', function(err, result) {
    L.info('Set to autocommit')
    self.client.query(schema)
  })
}

var handleError = function(d, err) {
  if (err instanceof Object) {
    L.info(U.inspect(err))
    d.reject(db_error(err))
    return true
  }
  return false
}

PostgresqlDriver.prototype.__setup = function() {
}

// TODO
PostgresqlDriver.prototype.nodeExists = function(uri) {
  var self = this, d = Q.defer()
  var q = self.client.query('SELECT * FROM '+self.data_table+' WHERE uri = $1', [uri.toString()])
  q.on('row', function(row, result) { result.addRow(row) })
  q.on('end', function(result) {
    if (result.rows.length !== 1) { d.reject(new Error('Node not found')); return }
    d.resolve(JSON.parse(result.rows[0].content))
  })
  q.on('error', function(err) { handleError(d, err) })
  return d.promise

  return self.__getDBRow(uri).then(function(row) {
    return Q(JSON.parse(row.content))
  })
}

PostgresqlDriver.prototype.__nodeExists = function(uri) {
  var self = this, d = Q.defer()
  self.client.query('SELECT * FROM '+self.data_table+' WHERE uri = $1', [uri.toString()], function(err, result) {
    if (handleError(d, err)) return
    if (result.rows.length === 1)
      d.resolve(true)
    else
      d.resolve(false)
  })
  return d.promise

  return Q.ninvoke(self.client, 'query', 'SELECT * FROM '+self.data_table+' WHERE uri = $1', [ uri.toString() ]).then(function(result) {
    if (result.rows.length === 1)
      return Q(true)
    else if (result.rows.length === 0)
      return Q(false)
    else
      return Q.reject(new Error('Inconsistent database!'))
  })
}

PostgresqlDriver.prototype.__getDBRow = function(uri) {
  var self = this
  return Q.ninvoke(self.client, 'query', 'SELECT * FROM '+self.data_table+' WHERE uri = $1', [ uri.toString() ]).then(function(result) {
    if (result.rows.length === 1)
      return Q(result.rows[0])
    else if (result.rows.length === 0)
      return Q.reject(new Error('Node not found'))
    else
      return Q.reject(new Error('Inconsistent database!'))
  })
}

//TODO
PostgresqlDriver.prototype.getNodeWithParents = function(uri) {
  var self = this, pathA = [], d = Q.defer()
  while (! uri.isRoot() )
    pathA.push("'"+uri.toString()+"'")
  pathA.push("'"+uri.toString()+"'")
  self.client.query('SELECT * FROM '+self.data_table+' WHERE uri IN ('+pathA.join(',')+') ORDER BY uri', function(err, result) {
    if (handleError(d, err)) return
    if (pathA.length !== result.rows.length) {
      d.reject(new Error('Node not found'))
      return
    }
    var nodes = []
    for (var i=0; i<result.rows.length; i++)
      nodes.push(JSON.parse(result.rows[i].content))
    d.resolve(nodes)
  })
  return d.promise

  return Q.ninvoke(self.client, 'query', 'SELECT * FROM '+self.data_table+' WHERE uri IN ('+pathA.join(',')+') ORDER BY uri').then(function(result) {
    var nodes = []
    if (pathA.length !== result.rows.length)
      return Q.reject(new Error('Node not found'))
    for (var i=0; i<result.rows.length; i++)
      nodes.push(JSON.parse(result.rows[i].content))
    return Q(nodes)
  })
}

//TODO
PostgresqlDriver.prototype.createNode = function(uri, content) {
  var self = this//, d = Q.defer()

  return Q.ninvoke(self.client, 'query', 'SELECT * FROM '+self.data_table+' WHERE uri = $1', [uri.parent().toString()]).then(function(result) {
    return Q.ninvoke(self.client, 'query', 'INSERT INTO '+self.data_table+' (uri, parent_id, content) VALUES ($1, $2, $3)', [uri.toString(), result.rows[0].id, JSON.stringify(content)])
  })
/*
  var insertNode = function(parent_id) {
    L.info('Insert query for new node')
    self.client.query('INSERT INTO '+self.data_table+' (uri, parent_id, content) VALUES ($1, $2, $3)', [uri.toString(), parent_id, JSON.stringify(content)], function(err, result) {
      if (handleError(d,err))
        return
      L.debug(err)
      L.debug(result)
      d.resolve()
      //L.info('Node created')
      //self.client.end()
      //L.info('Client ended')
    })
  }
  self.client.query('SELECT * FROM '+self.data_table+' WHERE uri = $1', [uri.parent().toString()], function(err, result) {
    if (handleError(d, err)) return
    if (result.rows.length !== 1) { handleError(d, {message: 'Inconsistent database: ' + uri.parent().toString() + ' exists multiple times'}); return }

    insertNode(result.rows[0].id)
  })
  return d.promise*/
}

//TODO
PostgresqlDriver.prototype.updateNode = function(uri, content) {
  var self = this
  return Q.ninvoke(self.client, 'query', 'UPDATE '+self.data_table+' SET content = $1 WHERE uri = $2', [JSON.stringify(content), uri.toString()]).then(function() {
    return Q(null)
  })
}

//TODO
PostgresqlDriver.prototype.deleteNode = function(uri) {
  var self = this
  return Q.ninvoke(self.client, 'query', 'DELETE FROM '+self.data_table+' WHERE uri =~ $1', [ '^'+uri.toString() ]).then(function() {
    return Q(null)
  })
}

//TODO
PostgresqlDriver.prototype.listChildren = function(uri) {
  var self = this
  return self.__getDBRow(uri).then(function(row) {
    return Q.ninvoke(self.client, 'query', 'SELECT * FROM '+self.data_table+' WHERE parent_id = $1', [row.id]).then(function(result) {
      var nodes = []
      for (var i=0; i<result.rows.length; i++)
        nodes.push(JSON.parse(result.rows[i].content))
      return Q(nodes)
    })
  })
}

//TODO
PostgresqlDriver.prototype.__userExists = function(name) {
  var self = this
  return Q.ninvoke(self.client, 'query', 'SELECT * FROM '+self.user_table+' WHERE name = $1', [name]).then(function(result) {
    if (result.rows.length === 1)
      return Q(true)
    else
      return Q(false)
  })
}

//TODO
PostgresqlDriver.prototype.addUser = function(name, domain, password) {
  var self = this
  return self.__userExists().then(function(exists) {
    if (exists)
      return Q.reject(new Error('User already exists'))
    var node = { owner: name+'@'+domain, btime: moment().toISOString(), mtime: moment().toISOString(), acl: {}, data: "Welcome home" }
    node.acl[name+'@'+domain] = ['data-read', 'data-write', 'acl-read', 'acl-write', 'subscriptions-read', 'subscriptions-write', 'children-read', 'children-write', 'children-delete', 'attachment-read', 'attachment-write']
    return Q.ninvoke(self.client, 'query', 'INSERT INTO '+self.data_table+' (uri, content) VALUES ($1, $2)', [name+'@'+domain+'/', JSON.stringify(node)]).then(function() {
      return Q.ninvoke(self.client, 'query', 'INSERT INTO '+self.user_table+' (name, password) VALUES ($1, $2)', [name, password]).then(function() {
        return Q(true)
      })
    })
  })
}

//TODO
PostgresqlDriver.prototype.authenticateUser = function(name, password) {
  var self = this
  return Q.ninvoke(self.client, 'query', 'SELECT * FROM '+self.user_table+' WHERE name = $1 AND password = $2', [name, password]).then(function(result) {
    if (result.rows.length === 1)
      return Q(null)
    return Q.reject(new Error('Password did not match'))
  })
}

//TODO
PostgresqlDriver.prototype.writeAttachment = function(uri, buffer) {}

//TODO
PostgresqlDriver.prototype.readAttachment = function(uri) {}

module.exports = PostgresqlDriver
