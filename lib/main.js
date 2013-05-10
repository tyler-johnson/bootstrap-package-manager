var AsyncTasks, BOOTSTRAP_LESS_FILES, BOOTSTRAP_URL, BootstrapPackageManager, EventEmitter, UglifyJS, async, fs, less, minimatch, path, targz, utils, _,
  __slice = [].slice,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require("underscore");

async = require("async");

path = require("path");

fs = require('fs-extra');

EventEmitter = require("events").EventEmitter;

targz = require('tar.gz');

UglifyJS = require("uglify-js");

less = require('less');

utils = require("./utils");

minimatch = require("minimatch");

BOOTSTRAP_URL = "https://github.com/twitter/bootstrap/archive/<%=version%>.tar.gz";

BOOTSTRAP_LESS_FILES = [
  {
    file: "bootstrap.less",
    saveas: "bootstrap"
  }, {
    file: "responsive.less",
    saveas: "bootstrap-responsive"
  }
];

AsyncTasks = (function() {
  function AsyncTasks() {}

  AsyncTasks.prototype.on = function(name, fnc) {
    if (!_.isObject(this._t)) {
      this._t = {};
    }
    if (!_.isString(name)) {
      throw new TypeError("Expecting a name for first argument.");
    }
    if (!_.isFunction(fnc)) {
      throw new TypeError("Expecting a function for second argument.");
    }
    if (!_.has(this._t, name)) {
      this._t[name] = [];
    }
    return this._t[name].push(fnc);
  };

  AsyncTasks.prototype.fire = function() {
    var args, cb, name, queue, run, test, _i,
      _this = this;

    name = arguments[0], args = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), cb = arguments[_i++];
    if (!_.isObject(this._t)) {
      this._t = {};
    }
    if (!(queue = this._t[name])) {
      throw new Error("" + name + " event was not found.");
    }
    if (!(_.isArray(queue) && _.size(queue))) {
      return cb();
    }
    args.unshift(name);
    test = function() {
      return _.size(_this._t[name]);
    };
    run = function(callback) {
      var a;

      a = _.clone(args);
      a.push(callback);
      return _this._next.apply(_this, a);
    };
    return async.whilst(test, run, cb);
  };

  AsyncTasks.prototype._next = function() {
    var args, cb, done, e, fnc, name, queue, _i;

    name = arguments[0], args = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), cb = arguments[_i++];
    if (!_.isObject(this._t)) {
      this._t = {};
    }
    queue = this._t[name];
    if (!(_.isArray(queue) && _.size(queue))) {
      return false;
    }
    fnc = queue.shift();
    if (!_.isFunction(fnc)) {
      throw new TypeError("Task was not a function.");
    }
    done = function(err) {
      if (_.isFunction(cb)) {
        return cb.apply(null, arguments);
      } else if (err) {
        throw err;
      }
    };
    args.push(done);
    try {
      fnc.apply(this, args);
    } catch (_error) {
      e = _error;
      done(e);
    }
    return true;
  };

  return AsyncTasks;

})();

BootstrapPackageManager = (function(_super) {
  __extends(BootstrapPackageManager, _super);

  function BootstrapPackageManager(dir, options) {
    if (options == null) {
      options = {};
    }
    this.dir = path.resolve(process.cwd(), dir || "");
    this.options = _.defaults(options, {
      version: "master",
      parts: ["img", "css", "less", "js"],
      compress: ["css", "js"],
      concat: ["js"]
    });
    this.progress = new EventEmitter;
    this.runtime = null;
    this.init();
  }

  BootstrapPackageManager.prototype.init = function() {
    this.on("setup", function(next) {
      this.progress.emit("folder-setup");
      /* initial runtime setup
      */

      this.runtime.folders = {
        js: {
          folder: "js",
          whitelist: ["*.js"]
        },
        img: {
          folder: "img",
          whitelist: ["*.png"]
        },
        less: {
          folder: "less",
          whitelist: ["*.less"]
        }
      };
      return fs.mkdirs(this.dir, next);
    });
    this.on("download", function(next) {
      var cur, len, url,
        _this = this;

      this.progress.emit("download-start");
      url = _.template(BOOTSTRAP_URL, {
        version: this.options.version
      });
      cur = 0;
      len = 0;
      return utils.download_package(url, {
        dest: this.dir,
        start: function(res) {
          return len = parseInt(res.headers['content-length'], 10);
        },
        data: function(chunk) {
          cur += chunk.length;
          return _this.progress.emit("download", cur / len);
        },
        complete: function(dest) {
          _.extend(_this.runtime, {
            url: url,
            archive: dest
          });
          _this.progress.emit("download-end");
          return next();
        },
        error: next
      });
    });
    this.on("download", function(next) {
      var archive;

      this.progress.emit("unarchive");
      archive = this.runtime.archive;
      _.extend(this.runtime, {
        lib: path.join(path.dirname(archive), path.basename(archive, ".tar.gz"))
      });
      return new targz().extract(archive, this.dir, next);
    });
    this.on("install", function(next) {
      return fs.copy(path.join(this.runtime.lib, "LICENSE"), path.join(this.dir, "LICENSE"), next);
    });
    this.on("install", function(next) {
      var folders, process,
        _this = this;

      this.progress.emit("copy-parts");
      folders = this.runtime.folders;
      process = function(part, cb) {
        var data, dest, src;

        if (!(data = folders[part])) {
          return cb();
        }
        src = path.join(_this.runtime.lib, data.folder);
        dest = path.join(_this.dir, data.folder);
        return fs.remove(dest, function(err) {
          if (err) {
            return cb(err);
          }
          return fs.copy(src, dest, function(err) {
            if (err) {
              return cb(err);
            }
            return fs.readdir(dest, function(err, files) {
              var clean;

              if (err) {
                return cb(err);
              }
              clean = function(file, callback) {
                var pass;

                pass = _.some(data.whitelist, function(w) {
                  return minimatch(file, w);
                });
                if (pass) {
                  return callback();
                } else {
                  return fs.remove(path.join(dest, file), callback);
                }
              };
              return async.each(files, clean, cb);
            });
          });
        });
      };
      return async.each(this.options.parts, process, next);
    });
    this.on("compile", function(next) {
      var folder, order;

      if (_.contains(this.options.parts, "js")) {
        this.progress.emit("compile-js");
      }
      if (!(_.contains(this.options.parts, "js") && _.contains(this.options.concat, "js"))) {
        return next();
      }
      folder = path.join(this.dir, "js");
      order = ["transition", "alert", "button", "carousel", "collapse", "dropdown", "modal", "tooltip", "popover", "scrollspy", "tab", "typeahead", "affix"];
      return fs.readdir(folder, function(err, files) {
        var reduce, truname;

        if (err) {
          return cb(err);
        }
        truname = /^bootstrap\-([^\.]+)\.js$/i;
        files = _.sortBy(files, function(f) {
          var i, m;

          if (!(m = truname.exec(f))) {
            return 999;
          }
          i = _.indexOf(order, m[1]);
          if (i > -1) {
            return i;
          } else {
            return 999;
          }
        });
        reduce = function(memo, file, callback) {
          file = path.join(folder, file);
          return fs.readFile(file, function(err, data) {
            var ret;

            if (err) {
              return callback(err);
            }
            if (memo) {
              ret = Buffer.concat([memo, data]);
            } else {
              ret = data;
            }
            return callback(null, ret);
          });
        };
        return async.reduce(files, null, reduce, function(err, data) {
          if (err) {
            return next(err);
          }
          return fs.remove(folder, function(err) {
            if (err) {
              return next(err);
            }
            return fs.mkdirs(folder, function(err) {
              if (err) {
                return next(err);
              }
              return fs.writeFile(path.join(folder, "bootstrap.js"), data, next);
            });
          });
        });
      });
    });
    this.on("compile", function(next) {
      var folder;

      if (!(_.contains(this.options.parts, "js") && _.contains(this.options.compress, "js"))) {
        return next();
      }
      folder = path.join(this.dir, "js");
      return fs.readdir(folder, function(err, files) {
        var compress;

        if (err) {
          return cb(err);
        }
        compress = function(file, callback) {
          var ext, name, newfile, result;

          file = path.join(folder, file);
          result = UglifyJS.minify(file);
          ext = path.extname(file);
          name = path.basename(file, ext) + ".min" + ext;
          newfile = path.join(folder, name);
          return fs.writeFile(newfile, result.code, callback);
        };
        return async.each(files, compress, next);
      });
    });
    this.on("compile", function(next) {
      var compress, css_folder, dir, folder;

      if (!_.contains(this.options.parts, "css")) {
        return next();
      }
      this.progress.emit("compile-css");
      dir = this.dir;
      folder = path.join(this.runtime.lib, "less");
      css_folder = path.join(dir, "css");
      compress = _.contains(this.options.compress, "css");
      return fs.mkdirs(css_folder, function(err) {
        var compile;

        if (err) {
          return next(err);
        }
        compile = function(filedata, callback) {
          var file, parser;

          file = path.join(folder, filedata.file);
          parser = new less.Parser({
            paths: [folder],
            filename: filedata.file
          });
          return fs.readFile(file, function(err, data) {
            if (err) {
              return next(err);
            }
            return parser.parse(data.toString("utf8"), function(err, tree) {
              var base, saveas;

              if (err) {
                return next(err);
              }
              saveas = filedata.saveas || path.basename(file, path.extname(file));
              base = path.join(css_folder, saveas);
              return async.parallel([
                function(cb) {
                  var output;

                  output = tree.toCSS();
                  return fs.writeFile(base + ".css", output, cb);
                }, function(cb) {
                  var output;

                  if (!compress) {
                    return cb();
                  }
                  output = tree.toCSS({
                    yuicompress: true
                  });
                  return fs.writeFile(base + ".min.css", output, cb);
                }
              ], callback);
            });
          });
        };
        return async.each(BOOTSTRAP_LESS_FILES, compile, next);
      });
    });
    return this.on("cleanup", function(next) {
      var rm;

      this.progress.emit("cleanup");
      rm = _.values(_.pick(this.runtime, "archive", "lib"));
      return async.each(rm, fs.remove, next);
    });
  };

  BootstrapPackageManager.prototype.run = function(cb) {
    var events;

    events = ["setup", "download", "install", "compile", "cleanup"];
    this.runtime = {};
    return async.eachSeries(events, this.fire.bind(this), function() {
      this.runtime = null;
      return cb.apply(null, arguments);
    });
  };

  return BootstrapPackageManager;

})(AsyncTasks);

module.exports = BootstrapPackageManager;
