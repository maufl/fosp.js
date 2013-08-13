var fosp = require('./fosp');
var Client = require('./fosp/client');
var readline = require('readline');
var options = { port: 1337, domain: 'example.com' };

var rl = readline.createInterface({
    input: process.stdin,
      output: process.stdout
});

console.log('Starting client');
var client = new Client(options);
var cwd = 'test@example.net';
var seq = 1;
var waitForResponse = false;

client.on('open', function() {
  console.log('Established connection');
  rl.setPrompt('fosp:'+cwd+'>');
  rl.prompt();
  rl.on('line', function(line) {
    var argv = line.split(' ');
    var command = argv.shift();
    switch(command) {
      case 'cd':
        if (argv[0]) {
          cd(argv[0]);
          rl.setPrompt('fosp:' + cwd + '>');
        }
        else {
          console.log('Missing argument for cd');
        }
        break;
      case 'pwd':
        console.log(cwd);
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
          console.log('To few arguments for create');
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
          console.log('To few arguments for create');
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
        console.log('Unknown command');
        break;
    }
    if (!waitForResponse)
      rl.prompt();
  });
});

client.on('error', function(msg) {
  console.log();
  console.error(msg);
  process.exit(1);
});
client.on('close', function() {
  console.log();
  console.log('Connection closed');
  process.exit(1);
});
client.on('message', function(msg) {
  console.log();
  console.log(msg);
  waitForResponse = false;
  rl.prompt();
});


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
        console.log('Already at the root of tree');
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
      console.log('Invalid dir ' + dir);
      cwd = oldCwd;
      break;
    }
  }
};

var register = function(argv) {
  client.con.sendRegister(seq, {}, { name: argv[0], password: argv[1] });
  seq++;
}

var authenticate = function(argv) {
  client.con.sendAuthenticate(seq, {}, { name: argv[0], password: argv[1] });
  seq++;
}

var select = function(arg) {
  var oldCwd = cwd;
  cd(arg);
  client.con.sendSelect(cwd, seq);
  seq++;
  cwd = oldCwd;
  waitForResponse = true;
};

var create = function(name, body) {
  var path = cwd + "/" + name;
  client.con.sendCreate(path, seq, {}, body);
  seq++;
}

var update = function(name, body) {
  var path = cwd;
  if (name !== '.')
    path += '/' + name;
  client.con.sendUpdate(path, seq, {}, body);
  seq++;
}

var _delete = function(name) {
  var oldCwd = cwd;
  cd(name);
  client.con.sendDelete(cwd, seq);
  seq++;
  cwd = oldCwd;
  waitForResponse = true;
}

var list = function(name) {
  var oldCwd = cwd;
  cd(name);
  client.con.sendList(cwd, seq);
  seq++;
  cwd = oldCwd;
  waitForResponse = true;
}
