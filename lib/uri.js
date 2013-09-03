// fosp uris
(function(){
var buildModule = function(L) {
  var URI = function(string) {
    var self = this;
    var i = string.indexOf("/");
    if (i === -1)
      i = string.length;
    self.user = string.substr(0, i);
    self.path = string.substr(i, string.length);
    if (self.path === '')
      self.path = '/';

    if (! self.user.match(/^[a-zA-Z0-9_\-.]+@[a-zA-Z0-9_\-.]+$/)) {
      L.error('Invalid user in uri: ' + string);
      throw new Error("Invalid user");
    }
    i = self.user.indexOf("@");
    self.user = { name: self.user.substr(0, i), domain: self.user.substr(i + 1, self.user.length) };
  };

  URI.prototype.toString = function() {
    return this.user.name + "@" + this.user.domain + this.path;
  }
  URI.prototype.fqUser = function() {
    return this.user.name + "@" + this.user.domain;
  }
  URI.prototype.parent = function() {
    var self = this
    if (self.isRoot())
      return self
    var pathArray = self.path.split('/')
    pathArray.pop()
    return new URI(self.fqUser() + pathArray.join('/'))
  }

  URI.prototype.isRoot = function() {
    return this.path === '/'
  }

  URI.ancestorOf = function(parent, child) {
    return (child.indexOf(parent) === 0 && child.length > parent.length)
  }

  URI.parentOf = function(parent, child) {
    if (!URI.ancestorOf(parent,child))
      return false
    L.debug('Is parent ' + parent + ' :: ' + child)
    var tail = child.substring(parent.length + 1)
    L.debug('Tail is ' + tail)
    if (tail.indexOf('/') < 0)
      return true
    return false
  }

  return URI
}
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = buildModule(require('./logger').forFile(__filename));
}
else if (typeof define === 'function' && define.amd) {
  define(['./logger'], function(logger) {
    return buildModule(logger.forFile('fosp/uri'));
  })
}
})();
