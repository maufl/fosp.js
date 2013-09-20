var Q = require('q')
var Client = require('../lib/client')

var tests = {}

var L = console.log

tests.set = function(h) {
  return function() {
    for (k in h) {
      var key = this.interpolate(k), value = this.interpolate(h[k])
      this.vars[key] = value
    }
    return Q()
  }
}

tests.for = function(t) {
  return function() {
    var i = this.index - 1, currentLabel = this.labels[this.labels.length - 1]
    if (typeof currentLabel === 'undefined' || currentLabel.index !== i) {
      this.labels.push({ index: i, state: t })
      currentLabel = this.labels[this.labels.length - 1]
    }
    if (currentLabel.state === 0) {
      this.index = currentLabel.end
      this.labels.pop()
      return Q()
    }
    currentLabel.state--
    return Q()
  }
}

tests.end = function() {
  return function() {
    var currentLabel = this.labels[this.labels.length - 1]
    if (! currentLabel.end)
      currentLabel.end = this.index
    this.index = currentLabel.index
    return Q()
  }
}

tests.wait = function(t) {
  return function() {
    var d = Q.defer()
    setTimeout(function() { d.resolve() }, t)
    return d.promise
  }
}

tests.connect = function(h, options) {
  return function() {
    if (h)
      h = this.interpolate(h)
    var o = options || {}, host = h || 'localhost.localdomain', port = o.port || 1337, version = o.version || '0.1', d = Q.defer(), timeout = o.timeout || 5000, expect = o.expect || 'SUCCEDED'
    L('Creating new client')
    var self = this, c = new Client( { host: host, port: port } )
    this.vars.C = c
    if (o.as)
      this.vars[o.as] = c
    var t = setTimeout(function() { d.reject('Connect timed out after ' + timeout) }, timeout)
    L('Sending Connect')
    c.on('connect', function() {
      c.con.sendConnect({}, { version: version }).on('response', function(resp) {
        L('Recieved response ' + resp.short())
        clearTimeout(t)
        if (expect !== resp.response)
          d.reject('CONNECT to ' + host + ' failed')
        else
          d.resolve(c)
      })
    })
    return d.promise
  }
}

tests.register = function(n, p, o) {
  return function() {
    var name = this.interpolate(n), password = this.interpolate(p)
    return singleRequest.call(this, 'REGISTER', null, null, { name: name, password: password }, o)
  }
}

tests.authenticate = function(n, p, o) {
  return function() {
    var name = this.interpolate(n), password = this.interpolate(p)
    return singleRequest.call(this, 'AUTHENTICATE', null, null, { name: name, password: password }, o)
  }
}

tests.select = function(u, o) {
  return function() {
    var uri = this.interpolate(u)
    return singleRequest.call(this, 'SELECT', uri, null, null, o)
  }
}

tests.create = function(u, b, o) {
  return function() {
    var uri = this.interpolate(u), body = this.interpolate(b)
    return singleRequest.call(this, 'CREATE', uri, null, body, o)
  }
}

tests.update = function(u, b, o) {
  return function() {
    var uri = this.interpolate(u), body = this.interpolate(b)
    return singleRequest.call(this, 'UPDATE', uri, null, body, o)
  }
}

tests.delete = function(u, o) {
  return function() {
    var uri = this.interpolate(u)
    return singleRequest.call(this, 'DELETE', uri, null, null, o)
  }
}

tests.list = function(u, o) {
  return function() {
    var uri = this.interpolate(u)
    return singleRequest.call(this, 'LIST', uri, null, null, o)
  }
}

var singleRequest = function(request, uri, headers, body, options) {
  var self = this, o = options || {}, o = this.interpolate(o), timeout = (o.timeout || 5000), on = (o.on || this.vars.C),
      uri = (uri || null), headers = (headers || {}), body = (body || null), expect = o.expect || 'SUCCEDED', d = Q.defer()
  var t = setTimeout(function() { d.reject(request + ' timed out after ' + timeout + 'ms')}, timeout);
  var req = on.con.sendRequest(request, uri, headers, body)
  L('Sending new request ' + req.toString())
  var m = this.startMeasurement(req.short())
  req.on('response', function(resp) {
    L('Recieved response ' + resp.toString())
    self.stopMeasurement(m)
    clearTimeout(t)
    if (resp.response !== expect)
      d.reject(request + ' ' + uri + ' response type is not ' + expect + ' but ' + resp.response)
    else if (o.resp && o.resp.status && o.resp.status !== resp.status)
      d.reject(request + ' ' + uri + ' response status is not ' + o.resp.status + ' but ' + resp.status)
    else
      d.resolve(resp)
  })
  return d.promise
}

module.exports = tests
