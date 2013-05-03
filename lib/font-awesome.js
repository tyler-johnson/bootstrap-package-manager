var FONTAWESOME_URL, async, fs, path, request, targz, utils, _;

_ = require("underscore");

request = require("request");

path = require("path");

fs = require("fs-extra");

targz = require('tar.gz');

utils = require("./utils");

async = require("async");

FONTAWESOME_URL = "https://github.com/FortAwesome/Font-Awesome/archive/<%=version%>.tar.gz";

module.exports = function(BPM) {
  var options;

  if (!BPM.options["font-awesome"]) {
    return;
  }
  options = _.defaults(BPM.options["font-awesome"], {
    path: null,
    version: "master"
  });
  BPM.on("download", function(next) {
    var cur, len, url,
      _this = this;

    url = _.template(FONTAWESOME_URL, {
      version: options.version
    });
    cur = 0;
    len = 0;
    return utils.download_package(url, {
      dest: this.dir,
      start: function(res) {
        len = parseInt(res.headers['content-length'], 10);
        return _this.progress.emit("fa-download-start");
      },
      data: function(chunk) {
        cur += chunk.length;
        return _this.progress.emit("fa-download", cur / len);
      },
      complete: function(dest) {
        _.extend(_this.runtime, {
          fa_url: url,
          fa_archive: dest
        });
        _this.progress.emit("fa-download-end");
        return next();
      },
      error: next
    });
  });
  BPM.on("download", function(next) {
    var archive;

    this.progress.emit("fa-unarchive");
    archive = this.runtime.fa_archive;
    _.extend(this.runtime, {
      fa_lib: path.join(path.dirname(archive), path.basename(archive, ".tar.gz"))
    });
    return new targz().extract(archive, this.dir, next);
  });
  BPM.on("download", function(next) {
    var to_folder,
      _this = this;

    this.progress.emit("fa-copy-less");
    to_folder = path.join(this.runtime.lib, "less");
    return fs.copy(path.join(this.runtime.fa_lib, "less"), to_folder, function(err) {
      if (err) {
        return next(err);
      }
      return async.parallel([
        function(cb) {
          if (!options.path) {
            return cb();
          }
          return utils.fix_file(path.join(to_folder, "font-awesome.less"), /@FontAwesomePath(.*?);/i, "@FontAwesomePath: \"" + options.path + "\";", cb);
        }, function(cb) {
          return utils.fix_file(path.join(to_folder, "bootstrap.less"), "sprites.less", "font-awesome.less", cb);
        }
      ], next);
    });
  });
  BPM.on("install", function(next) {
    this.progress.emit("fa-copy-fonts");
    return fs.copy(path.join(this.runtime.fa_lib, "font"), path.join(this.dir, "font"), next);
  });
  return BPM.on("cleanup", function(next) {
    var rm;

    this.progress.emit("fa-cleanup");
    rm = _.values(_.pick(this.runtime, "fa_archive", "fa_lib"));
    return async.each(rm, fs.remove, next);
  });
};
