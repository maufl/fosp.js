// Object to save information about a connection

var Context = function(options) {
  var self = this;
  if (typeof options !== 'object' || options === null)
    options = {}
  self.negotiated = !!options.negotiated || false;
  self.authenticated = !!options.authenticated || false;
  self.version = options.version || "";
  self.type = options.type || "";
  self.user = options.user || '';
  self.remote_domain = options.remote_domain || '';
};

module.exports = Context;
