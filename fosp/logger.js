// Central setup of logger
(function(){

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    var winston = require('winston');
    var path = require('path');
    var parentPath = path.normalize(path.join(__dirname, '..'));
    var globalLevel = 'info';

    var forFile = function(filename) {
      var name = path.relative(parentPath, filename);
        winston.loggers.add(name, {
          console: {
            level: globalLevel,
            colorize: true,
            label: name
          }
        });
        return winston.loggers.get(name);
    }

    module.exports = {
      forFile: forFile
    }
  }
  else if (typeof define === 'function' && define.amd) {
    var logLevels = ['verbose','debug','log','info','warn','error']
    var log = function(level,module,message) {
      if (logLevels.indexOf(console.level) <= logLevels.indexOf(level)) {
        if (typeof console[level] === 'function') {
          console[level].call(console, level + ' [' + module + '] ' +message)
        }
        else {
          console.log(level + ' [' + module + '] ' +message)
        }
      }
    }
    var forFile = function(name) {
      return {
        log: function(text) { log('log',name,text) },
        verbose: function(text) { log('verbose',name,text) },
        debug: function(text) { log('debug',name,text) },
        info: function(text) { log('info',name,text) },
        warn: function(text) { log('warn',name,text) },
        error: function(text) { log('error',name,text) },
      }
    }
    define({ forFile: forFile });
  }
})();
