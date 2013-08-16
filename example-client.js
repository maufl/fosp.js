// more or less simple example client
var readline = require('readline');
var sprintf = require('sprintf').sprintf;
var fosp = require('./fosp');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var log = function(text) {
  console.log('example-client: ' + text);
}

log('Starting client');

var state = { user: { name: 'felix', domain: 'mighty-maufl.localdomain', password: 'passwort'}, cwd: 'felix@mighty-maufl.localdomain' };
var client = new fosp.Client({host: state.user.domain});

client.con.on('open', function() {
  log('Established connection');
  log('Negotiating version');
  client.con.sendConnect({}, {version: "0.1"}).on('failed', function(resp) {
    log('Failed to negotiate connection');
    log(resp.toString());
    log('Exiting');
    exit(1);
  }).on('succeded', function(resp) {
    log('Successfully negotiated connection!')
    log('Authenticating ...')
    client.con.sendAuthenticate({}, { name: state.user.name, password: state.user.password }).on('failed', function(resp) {
      log('Authenticating failed, try again yourself (use "authenticate")');
      prompt()
    }).on('succeded', function(resp) {
      log('Succesfully authenticated!');
      prompt()
    });
  });
});

rl.on('line', function(line) {
  var argv = line.split(' ');
  var command = argv.shift();
  switch(command) {
    case 'cd':
      if (argv[0]) {
        cd(argv[0]);
        prompt();
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
      prompt();
      break;
  }
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

var setPrompt = function() {
  rl.setPrompt(state.user.name +'@' + state.user.domain + ' on ' + state.cwd + '>');
}

var prompt = function() {
  setPrompt();
  rl.prompt();
}


var cd = function(arg) {
  var dirs = arg.split('/');
  var oldCwd = state.cwd;
  for (var i=0; i<dirs.length; i++) {
    var dir = dirs[i];
    if (dir == '..') {
      var cwdDirs = cwd.split('/');
      if (cwdDirs.length > 1) {
        cwdDirs.pop();
        state.cwd = cwdDirs.join('/');
      }
      else {
        log('Already at the root of tree');
        state.cwd = oldCwd;
        break;
      }
    }
    else if (dir == '.') {
      continue;
    }
    else if (dir.match(/^[a-zA-Z][a-zA-Z0-9_\-+.]*@[a-zA-Z0-9._\-+]+$/) && i == 0) {
      state.cwd = dir;
    }
    else if (dir.match(/^[a-zA-Z][a-zA-Z0-9+_\-.]*$/)) {
      state.cwd += "/" + dir;
    }
    else {
      log('Invalid dir ' + dir);
      state.cwd = oldCwd;
      break;
    }
  }
};

var formatResponsePrompt = function(req, succeded, failed, timeout) {
  succeded = (typeof succeded === 'string') ? succeded : "Request %(req.request)s was successful: %(resp.body)s";
  failed = (typeof failed === 'string') ? failed : "Request %(req.request)s failed: %(resp.status)s :: %(resp.body)s";
  timeout = (typeof timeout === 'string') ? timeout : "Request %(req.request)s timed out";

  req.on('succeded', function(resp) {
    console.log(sprintf(succeded, {req: req, resp: resp}));
    prompt();
  });
  req.on('failed', function(resp) {
    console.log(sprintf(failed, {req: req, resp: resp}));
    prompt();
  });
  req.on('timeout', function(resp) {
    console.log(sprintf(timeout, {req: req, resp: resp}));
    prompt();
  });
}


var register = function(argv) {
  formatResponsePrompt(client.con.sendRegister({}, {name: argv[0], password: argv[1] }));
}

var authenticate = function(argv) {
  formatResponsePrompt(client.con.sendAuthenticate({}, { name: argv[0], password: argv[1] }));
}

var select = function(arg) {
  var oldCwd = state.cwd;
  cd(arg);
  formatResponsePrompt(client.con.sendSelect(state.cwd), "%(resp.body)s")
  state.cwd = oldCwd;
};

var create = function(name, body) {
  var path = state.cwd + "/" + name;
  formatResponsePrompt(client.con.sendCreate(path, {}, body))
}

var update = function(name, body) {
  var path = state.cwd;
  if (name !== '.')
    path += '/' + name;
  formatResponsePrompt(client.con.sendUpdate(path, {}, body));
}

var _delete = function(name) {
  var oldCwd = state.cwd;
  cd(name);
  formatResponsePrompt(client.con.sendDelete(state.cwd));
  state.cwd = oldCwd;
}

var list = function(name) {
  var oldCwd = state.cwd;
  cd(name);
  formatResponsePrompt(client.con.sendList(state.cwd), '%(resp.body)s');
  state.cwd = oldCwd;
}
