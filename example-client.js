// more or less simple example client
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
  self.client.con.on('open', function() {
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
  });

  self.rl.on('line', function(line) {
    var argv = line.split(' ');
    var command = argv.shift();
    switch(command) {
      case 'cd':
        if (argv[0]) {
          self.cd(argv[0]);
          self.prompt();
        }
        else {
          L.error('Missing argument for cd');
        }
        break;
      case 'pwd':
        console.log(cwd);
        break;
      case 'exit':
        process.exit(0);
        break;
      case 'register':
        self.register(argv);
        break;
      case 'authenticate':
        self.authenticate(argv);
        break;
      case 'select':
        if (argv[0])
          self.select(argv[0]);
        else
          self.select('.');
        break;
      case 'create':
        if (argv.length < 2) {
          L.error('To few arguments for create');
          break;
        }
        else {
          var name = argv.shift();
          var body = JSON.parse(argv.join(" "));
          self.create(name, body);
        }
        break;
      case 'update':
        if (argv.length < 2) {
          L.error('To few arguments for create');
          break;
        }
        else {
          var name = argv.shift();
          var body = JSON.parse(argv.join(" "));
          self.update(name, body);
        }
        break;
      case 'delete':
        if (argv[0])
          self._delete(argv[0]);
        else
          self._delete('.');
        break;
      case 'list':
        if (argv[0])
          self.list(argv[0]);
        else
          self.list('.');
        break;
      default:
        L.warn('Unknown command');
        self.prompt();
        break;
    }
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

}

ExampleClient.prototype.setPrompt = function() {
  this.rl.setPrompt(this.config.user.name +'@' + this.config.user.domain + ' on ' + this.config.cwd + '>');
}

ExampleClient.prototype.prompt = function() {
  this.setPrompt();
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


ExampleClient.prototype.register = function(argv) {
  this.formatResponsePrompt(this.client.con.sendRegister({}, {name: argv[0], password: argv[1] }));
}

ExampleClient.prototype.authenticate = function(argv) {
  this.formatResponsePrompt(this.client.con.sendAuthenticate({}, { name: argv[0], password: argv[1] }));
}

ExampleClient.prototype.select = function(arg) {
  var oldCwd = this.config.cwd;
  this.cd(arg);
  this.formatResponsePrompt(this.client.con.sendSelect(this.config.cwd), "%(resp.body)s")
  this.config.cwd = oldCwd;
};

ExampleClient.prototype.create = function(name, body) {
  var path = this.config.cwd + "/" + name;
  this.formatResponsePrompt(this.client.con.sendCreate(path, {}, body))
}

ExampleClient.prototype.update = function(name, body) {
  var path = this.config.cwd;
  if (name !== '.')
    path += '/' + name;
  this.formatResponsePrompt(this.client.con.sendUpdate(path, {}, body));
}

ExampleClient.prototype._delete = function(name) {
  var oldCwd = this.config.cwd;
  this.cd(name);
  this.formatResponsePrompt(this.client.con.sendDelete(this.config.cwd));
  this.config.cwd = oldCwd;
}

ExampleClient.prototype.list = function(name) {
  var oldCwd = this.config.cwd;
  this.cd(name);
  this.formatResponsePrompt(this.client.con.sendList(this.config.cwd), '%(resp.body)s');
  this.config.cwd = oldCwd;
}

new ExampleClient();
