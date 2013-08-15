var fosp = require('./fosp');
var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
    output: process.stdout
});

var log = function(text) {
  console.log('example-client: ' + text);
}

log('Starting client');
var client = new fosp.Client();
var cwd = 'X';
var waitForResponse = false;
var user = '';

client.con.on('open', function() {
  log('Established connection');
  log('Negotiating version');
  client.con.sendConnect({}, {version: "0.1"});
  setPrompt();
  rl.prompt();
  rl.on('line', function(line) {
    var argv = line.split(' ');
    var command = argv.shift();
    switch(command) {
      case 'cd':
        if (argv[0]) {
          cd(argv[0]);
          setPrompt();
        }
        else {
          log('Missing argument for cd');
        }
        break;
      case 'pwd':
        log(cwd);
        break;
      case 'exit':
        process.exit(0);
        break;
      case 'register':
        register(argv);
        break;
      case 'authenticate':
        authenticate(argv);
        break;
      case 'select':
        if (argv[0])
          select(argv[0]);
        else
          select('.');
        break;
      case 'create':
        if (argv.length < 2) {
          log('To few arguments for create');
          break;
        }
        else {
          var name = argv.shift();
          var body = JSON.parse(argv.join(" "));
          create(name, body);
        }
        break;
      case 'update':
        if (argv.length < 2) {
          log('To few arguments for create');
          break;
        }
        else {
          var name = argv.shift();
          var body = JSON.parse(argv.join(" "));
          update(name, body);
        }
        break;
      case 'delete':
        if (argv[0])
          _delete(argv[0]);
        else
          _delete('.');
        break;
      case 'list':
        if (argv[0])
          list(argv[0]);
        else
          list('.');
        break;
      default:
        log('Unknown command');
        break;
    }
    if (!waitForResponse)
      rl.prompt();
  });
});

client.con.on('error', function(msg) {
  log();
  error(msg);
  process.exit(1);
});
client.con.on('close', function() {
  log();
  log('Connection closed');
  process.exit(1);
});
client.con.on('message', function(msg) {
  log();
  log(msg);
  waitForResponse = false;
  rl.prompt();
});

var setPrompt = function() {
  rl.setPrompt(user +'@localhost on ' + cwd + '>');
}


var cd = function(arg) {
  var dirs = arg.split('/');
  var oldCwd = cwd;
  for (var i=0; i<dirs.length; i++) {
    var dir = dirs[i];
    if (dir == '..') {
      var cwdDirs = cwd.split('/');
      if (cwdDirs.length > 1) {
        cwdDirs.pop();
        cwd = cwdDirs.join('/');
      }
      else {
        log('Already at the root of tree');
        cwd = oldCwd;
        break;
      }
    }
    else if (dir == '.') {
      continue;
    }
    else if (dir.match(/^[a-zA-Z][a-zA-Z0-9_\-+.]*@[a-zA-Z0-9._\-+]+$/) && i == 0) {
      cwd = dir;
    }
    else if (dir.match(/^[a-zA-Z][a-zA-Z0-9+_\-.]*$/)) {
      cwd += "/" + dir;
    }
    else {
      log('Invalid dir ' + dir);
      cwd = oldCwd;
      break;
    }
  }
};

var register = function(argv) {
  client.con.sendRegister({}, { name: argv[0], password: argv[1] });
}

var authenticate = function(argv) {
  client.con.sendAuthenticate({}, { name: argv[0], password: argv[1] });
  user = argv[0];
  if (cwd === 'X')
    cd(argv[0] + '@localhost')
}

var select = function(arg) {
  var oldCwd = cwd;
  cd(arg);
  client.con.sendSelect(cwd);
  cwd = oldCwd;
  waitForResponse = true;
};

var create = function(name, body) {
  var path = cwd + "/" + name;
  client.con.sendCreate(path, {}, body);
}

var update = function(name, body) {
  var path = cwd;
  if (name !== '.')
    path += '/' + name;
  client.con.sendUpdate(path, {}, body);
}

var _delete = function(name) {
  var oldCwd = cwd;
  cd(name);
  client.con.sendDelete(cwd);
  cwd = oldCwd;
  waitForResponse = true;
}

var list = function(name) {
  var oldCwd = cwd;
  cd(name);
  client.con.sendList(cwd);
  cwd = oldCwd;
  waitForResponse = true;
}
