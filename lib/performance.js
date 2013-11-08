// performance logging
var fs = require('fs')

var Performance = function() {
  this.file = null
  this.console = false
  this.mPoint = process.hrtime()
}

Performance.prototype.log = function(msg) {
  if (this.file === null && this.console === false)
    return

  var elapsed = process.hrtime(this.mPoint)
  var elapsedSec = elapsed[0]
  var elapsedMill = elapsed[1] / 1000000

  var str = elapsedSec + ' s , ' + elapsedMill + ' ms :: ' + msg

  if (this.file instanceof fs.WriteStream)
    this.file.write(str + '\n')
  if (this.console === true)
    console.log(str)

  this.mPoint = process.hrtime()
}

Performance.prototype.setFile = function(file) {
  if (file instanceof fs.WriteStream)
    this.file = file
}

var perf =  new Performance()

module.exports = perf
