var fs, path;

fs = require("fs-extra");

path = require("path");

module.exports = function(BPM) {
  var file;

  if (!(file = BPM.options["variables.less"])) {
    return;
  }
  return BPM.on("download", function(next) {
    var dest, src;

    this.progress.emit("variables-copy");
    src = path.resolve(process.cwd(), file);
    dest = path.join(this.runtime.lib, "less", "variables.less");
    return fs.copy(src, dest, next);
  });
};
