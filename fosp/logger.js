// Central setup of logger
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
