// fosp uris
var L = require('./logger').forFile(__filename);

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

module.exports = URI;
