// more or less simple example client
var events = require('events')
var readline = require('readline');
var sprintf = require('sprintf').sprintf;
var fs = require('fs');
var fosp = require('./fosp');
var L = require('./fosp/logger').forFile(__filename);

var ExampleClient = function() {
  var self = this;
  self.config = JSON.parse(fs.readFileSync('client.conf'));
  self.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  self.client = new fosp.Client({host: self.config.user.domain});

  L.info('Starting client');
  self.client.on('connect', function() {
    L.info('Established connection');
    L.info('Negotiating version');
    self.client.con.sendConnect({}, {version: "0.1"}).on('failed', function(resp) {
      L.info('Failed to negotiate connection');
      L.warn(resp.toString());
      L.warn('Exiting');
      exit(1);
    }).on('succeded', function(resp) {
      L.info('Successfully negotiated connection!')
      L.info('Authenticating ...')
      self.client.con.sendAuthenticate({}, { name: self.config.user.name, password: self.config.user.password }).on('failed', function(resp) {
        L.warn('Authenticating failed, try again yourself (use "authenticate")');
        self.prompt()
      }).on('succeded', function(resp) {
        L.info('Succesfully authenticated!');
        self.prompt()
      });
    });

    self.client.con.on('error', function(msg) {
      console.log();
      L.error(msg);
      process.exit(1);
    });
    self.client.con.on('close', function() {
      console.log();
      L.warn('Connection closed');
      process.exit(1);
    });
  });

  self.rl.on('line', function(line) {
    var params = line.split(' ');
    var command = params.shift();
    var validCommands = ['cd','pwd','exit','register','authenticate',
                         'select','create','update','delete','list'];
    if (validCommands.indexOf(command) >= 0)
      self.emit(command, params)
    else
      self.emit('unknown-command')
  });
}

ExampleClient.prototype = Object.create(events.EventEmitter.prototype)

ExampleClient.prototype.prompt = function() {
  this.rl.setPrompt(this.config.user.name +'@' + this.config.user.domain + ' on ' + this.config.cwd + '>');
  this.rl.prompt();
}

ExampleClient.prototype.cd = function(path) {
  var dirs = path.split('/');
  var oldCwd = this.config.cwd;
  for (var i=0; i<dirs.length; i++) {
    var dir = dirs[i];
    if (dir == '..') {
      var cwdDirs = cwd.split('/');
      if (cwdDirs.length > 1) {
        cwdDirs.pop();
        this.config.cwd = cwdDirs.join('/');
      }
      else {
        L.error('Already at the root of tree');
        this.config.cwd = oldCwd;
        break;
      }
    }
    else if (dir == '.') {
      continue;
    }
    else if (dir.match(/^[a-zA-Z][a-zA-Z0-9_\-+.]*@[a-zA-Z0-9._\-+]+$/) && i == 0) {
      this.config.cwd = dir;
    }
    else if (dir.match(/^[a-zA-Z][a-zA-Z0-9+_\-.]*$/)) {
      this.config.cwd += "/" + dir;
    }
    else {
      L.error('Invalid dir ' + dir);
      this.config.cwd = oldCwd;
      break;
    }
  }
};

ExampleClient.prototype.formatResponsePrompt = function(req, succeded, failed, timeout) {
  var self = this;
  succeded = (typeof succeded === 'string') ? succeded : "Request %(req.request)s was successful: %(resp.body)s";
  failed = (typeof failed === 'string') ? failed : "Request %(req.request)s failed: %(resp.status)s :: %(resp.body)s";
  timeout = (typeof timeout === 'string') ? timeout : "Request %(req.request)s timed out";

  req.on('succeded', function(resp) {
    console.log(sprintf(succeded, {req: req, resp: resp}));
    self.prompt();
  });
  req.on('failed', function(resp) {
    L.warn(sprintf(failed, {req: req, resp: resp}));
    self.prompt();
  });
  req.on('timeout', function(resp) {
    L.warn(sprintf(timeout, {req: req, resp: resp}));
    self.prompt();
  });
}

ExampleClient.prototype.paramsDefined = function() {
  for (arg in arguments) {
    if (typeof arg === 'undefined' || arg === null) {
      L.error('Missing parameters');
      return false;
    }
  }
  return true;
}

ExampleClient.prototype.tmpCd = function(path, func) {
  var oldCwd = this.config.cwd;
  this.cd(path);
  func.call(this, this.config.cwd);
  this.config.cwd = oldCwd;
}

ExampleClient.prototype.unariOperation = function(params, func) {
  var path = params[0];
  if (typeof path === 'undefined' || path === '')
    path = '.'
  this.tmpCd(path, function(dir) {
    func.call(this, dir);
  });
}

ExampleClient.prototype.userOperation = function(params, func) {
  var name = params[0], password = params[1];
  if (! this.paramsDefined(name, password) )
    return;
  this.formatResponsePrompt(func(name, password));
}

var fospClient = new ExampleClient();

fospClient.on('exit', function() {
  L.info('Exiting')
  process.exit(0)
});

fospClient.on('pwd', function() {
  console.log(this.config.cwd)
  this.prompt()
});

fospClient.on('cd', function(params) {
  var path = params[0];
  if (this.paramsDefined(path)) {
    this.cd(path);
    this.prompt();
  }
});

fospClient.on('register', function(params) {
  this.userOperation(params, function(name, password) {
    return this.client.con.sendRegister({}, {name: name, password: password });
  });
})

fospClient.on('authenticate', function(params) {
  this.userOperation(params, function(name, password) {
    return this.client.con.sendAuthenticate({}, { name: name, password: password });
  });
})

fospClient.on('select', function(params) {
  this.unariOperation(params, function(dir) {
    this.formatResponsePrompt(this.client.con.sendSelect(dir), "%(resp.body)s")
  });
});

fospClient.on('delete', function(params) {
  this.unariOperation(params, function(dir) {
    this.formatResponsePrompt(this.client.con.sendDelete(dir));
  });
})

fospClient.on('list', function(params) {
  this.unariOperation(params, function(dir) {
    this.formatResponsePrompt(this.client.con.sendList(dir), '%(resp.body)s');
  });
})

fospClient.on('create', function(params) {
  var path = params.shift(), body = JSON.parse(params.join(' ')), self = this;
  if (! this.paramsDefined(path, body) )
    return;
  self.tmpCd(path, function(dir) {
    self.formatResponsePrompt(self.client.con.sendCreate(dir, {}, body))
  });
})

fospClient.on('update', function(params) {
  var path = params.shift(), body = JSON.parse(params.join(' ')), self = this;
  if (! this.paramsDefined(path, body) )
    return;
  self.tmpCd(path, function(dir) {
    self.formatResponsePrompt(self.client.con.sendUpdate(dir, {}, body));
  });
})
