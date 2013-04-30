(function() {
  var download_package, fs, https, path, url, _;

  https = require("https");

  path = require("path");

  fs = require("fs");

  _ = require("underscore");

  url = require("url");

  download_package = module.exports.download_package = function(params, options) {
    var dest, fstream, name, req;

    options = _.defaults(options || {}, {
      dest: ".",
      redirect: function(res) {},
      start: function(res) {},
      data: function(chunk) {},
      complete: function() {},
      error: function(err) {}
    });
    if (_.isString(params)) {
      params = url.parse(params);
    }
    params.method = "GET";
    req = https.request(params);
    name = null;
    fstream = null;
    dest = null;
    req.on("response", function(res) {
      var match;

      if (res.headers.location) {
        options.redirect(res);
        return download_package(res.headers.location, options);
      } else {
        options.start(res);
        if (_.has(res.headers, 'content-disposition')) {
          match = /filename=(\S+)/.exec(res.headers['content-disposition']);
          if (match) {
            name = match[1];
          }
        }
        if (!name) {
          name = path.basename(params.pathname);
        }
        dest = path.resolve(process.cwd(), options.dest, name);
        res.on("error", options.error);
        res.on("data", options.data);
        res.on("end", function() {
          return options.complete(dest);
        });
        fstream = fs.createWriteStream(dest, {
          flags: 'w',
          mode: 0x1ff
        });
        return res.pipe(fstream);
      }
    });
    return req.end();
  };

  module.exports.fix_file = function(file, find, replace, cb) {
    return fs.readFile(file, "utf8", function(err, data) {
      if (err) {
        return cb(err);
      }
      data = data.replace(find, replace);
      return fs.writeFile(file, data, cb);
    });
  };

}).call(this);
