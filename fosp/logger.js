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
    var forFile = function(name) {
      return {
        log: function(text) { console.log('log ['+name+'] '+text) },
        debug: function(text) { console.log('debug ['+name+'] '+text) },
        verbose: function(text) { console.log('verbose ['+name+'] '+text) },
        info: function(text) { console.info('info ['+name+'] '+text) },
        warn: function(text) { console.warn('warn ['+name+'] '+text) },
        error: function(text) { console.error('error ['+name+'] '+text) },
      }
    }
    define({ forFile: forFile });
  }
})();
