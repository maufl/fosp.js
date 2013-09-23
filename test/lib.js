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

tests.for = function(t, as) {
  return function() {
    var i = this.index - 1, currentLabel = this.labels[this.labels.length - 1], a = as || 'i'
    if (typeof currentLabel === 'undefined' || currentLabel.index !== i) {
      this.labels.push({ index: i, state: t })
      currentLabel = this.labels[this.labels.length - 1]
    }
    if (currentLabel.state === 0) {
      this.index = currentLabel.end
      this.labels.pop()
      return Q()
    }
    this.vars[a] = t - currentLabel.state
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

tests.randomInt = function(as, limit) {
  return function() {
    this.vars[as] = Math.random() * (limit || 1)
    return Q()
  }
}
var guid = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}
tests.uuid = function (as) {
  return function() {
    this.vars[as] = guid()
    return Q()
  }
}
tests.randomString = function(as, length) {
  return function() {
    var l = length || 10, possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    this.vars[as] = ''
    for (var i=0; i<l; i++) {
      this.vars[as] += possible.charAt(Math.floor(Math.random() * possible.length))
    }
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
    var o = options || {}
    o = this.interpolate(o)
    var host = h || 'localhost.localdomain', port = o.port || 1337, version = o.version || '0.1', d = Q.defer(), timeout = o.timeout || 5000, expect = o.expect || 'SUCCEDED'
    L('Creating new client')
    L('Naming connection ' + o.as)
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
    var name = this.interpolate(n), password = this.interpolate(p), options = this.interpolate(o)
    return singleRequest.call(this, 'REGISTER', null, null, { name: name, password: password }, options)
  }
}

tests.authenticate = function(n, p, o) {
  return function() {
    var name = this.interpolate(n), password = this.interpolate(p), options = this.interpolate(o)
    return singleRequest.call(this, 'AUTHENTICATE', null, null, { name: name, password: password }, options)
  }
}

tests.select = function(u, o) {
  return function() {
    var uri = this.interpolate(u)
    return singleRequest.call(this, 'SELECT', uri, null, null, this.interpolate(o))
  }
}

tests.create = function(u, b, o) {
  return function() {
    var uri = this.interpolate(u), body = this.interpolate(b)
    return singleRequest.call(this, 'CREATE', uri, null, body, this.interpolate(o))
  }
}

tests.update = function(u, b, o) {
  return function() {
    var uri = this.interpolate(u), body = this.interpolate(b)
    return singleRequest.call(this, 'UPDATE', uri, null, body, this.interpolate(o))
  }
}

tests.delete = function(u, o) {
  return function() {
    var uri = this.interpolate(u)
    return singleRequest.call(this, 'DELETE', uri, null, null, this.interpolate(o))
  }
}

tests.list = function(u, o) {
  return function() {
    var uri = this.interpolate(u)
    return singleRequest.call(this, 'LIST', uri, null, null, this.interpolate(o))
  }
}

var singleRequest = function(request, uri, headers, body, options) {
  var o = {}
  if (options)
    o = this.interpolate(options)
  var self = this, timeout = (o.timeout || 5000), on = (this.vars[o.on] || this.vars.C),
      uri = (uri || null), headers = (headers || {}), body = (body || null), expect = o.expect || 'SUCCEDED', d = Q.defer()
  var t = setTimeout(function() { d.reject(request + ' timed out after ' + timeout + 'ms')}, timeout);
  var req = on.con.sendRequest(request, uri, headers, body)
  L('Sending new request ' + req.toString())
  var s = this.startMeasurement()
  req.on('response', function(resp) {
    L('Recieved response ' + resp.toString())
    self.stopMeasurement(s,req.request,req.seq, o.on || 'default')
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
