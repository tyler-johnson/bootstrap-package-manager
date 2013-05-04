var BOOTSWATCH_API_URL, async, fs, path, request, utils, _;

_ = require("underscore");

path = require("path");

fs = require("fs-extra");

utils = require("./utils");

async = require("async");

request = require("request");

BOOTSWATCH_API_URL = "http://api.bootswatch.com";

module.exports = function(BPM) {
  var theme;

  if (!(theme = BPM.options.theme)) {
    return;
  }
  theme = theme.toLowerCase();
  return BPM.on("download", function(next) {
    var _this = this;

    this.progress.emit("theme-install");
    return request.get({
      url: BOOTSWATCH_API_URL,
      json: true
    }, function(err, res, body) {
      var dest, download, themedata, urls;

      if (err) {
        return next(err);
      }
      themedata = _.find(body.themes, function(t) {
        return t.name.toLowerCase() === theme;
      });
      if (!themedata) {
        return next(new Error("Bootswatch Theme " + theme + " couldn't be found."));
      }
      urls = _.values(_.pick(themedata, "less", "lessVariables"));
      dest = path.join(_this.runtime.lib, "less");
      download = function(url, callback) {
        return utils.download_package(url, {
          dest: dest,
          start: function(res) {},
          data: function(chunk) {},
          complete: function(dest) {
            return callback();
          },
          error: callback
        });
      };
      return async.each(urls, download, function(err) {
        if (err) {
          return next(err);
        } else {
          return fs.appendFile(path.join(dest, "bootstrap.less"), '\n@import "bootswatch.less";', next);
        }
      });
    });
  });
};
