var download_package, fs, path, url, _;

path = require("path");

fs = require("fs");

_ = require("underscore");

url = require("url");

download_package = module.exports.download_package = function(params, options) {
  var error, http, req;

  options = _.defaults(options || {}, {
    dest: ".",
    redirect: function(res) {},
    start: function(res) {},
    data: function(chunk) {},
    complete: function(dest) {},
    error: function(err) {}
  });
  error = _.once(options.error);
  if (_.isString(params)) {
    params = url.parse(params);
  }
  if (params.protocol === "https:") {
    http = require("https");
  } else {
    http = require("http");
  }
  req = http.get(params, function(res) {
    var dest, fstream, match, name;

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
      fstream = fs.createWriteStream(dest, {
        flags: 'w',
        mode: 0x1ff
      });
      fstream.on("error", error);
      res.on("data", options.data);
      fstream.on("finish", function() {
        return options.complete(dest);
      });
      return res.pipe(fstream);
    }
  });
  return req.on("error", error);
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

module.exports.split = function(str, sep) {
  var i, len, part, parts, rawParts;

  rawParts = str.split(sep);
  parts = [];
  i = 0;
  len = rawParts.length;
  while (i < len) {
    part = "";
    while (rawParts[i].slice(-1) === "\\") {
      part += rawParts[i++].slice(0, -1) + sep;
    }
    parts.push(part + rawParts[i]);
    i++;
  }
  return parts;
};
