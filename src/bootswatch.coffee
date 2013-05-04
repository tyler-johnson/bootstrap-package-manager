# Dependencies
_ = require "underscore"
path = require "path"
fs = require "fs-extra"
utils = require "./utils"
async = require "async"
request = require "request"

# Major Variables
BOOTSWATCH_API_URL = "http://api.bootswatch.com"

module.exports = (BPM) ->
	# Theme Option
	unless theme = BPM.options.theme then return
	theme = theme.toLowerCase()

	BPM.on "download", (next) ->
		@progress.emit "theme-install"

		request.get {
			url: BOOTSWATCH_API_URL,
			json: true
		}, (err, res, body) =>
			if err then return next(err)
			
			themedata = _.find body.themes, (t) ->
				return t.name.toLowerCase() is theme
			unless themedata then return next new Error "Bootswatch Theme #{theme} couldn't be found."

			urls = _.values _.pick themedata, "less", "lessVariables"
			dest = path.join @runtime.lib, "less"

			download = (url, callback) =>
				utils.download_package url,
					dest: dest
					start: (res) ->
					data: (chunk) ->
					complete: (dest) ->
						callback()
					error: callback

			async.each urls, download, (err) ->
				if err then next(err)
				else fs.appendFile path.join(dest, "bootstrap.less"), '\n@import "bootswatch.less";', next