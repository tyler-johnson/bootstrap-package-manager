https = require "https"
path = require "path"
fs = require "fs"
_ = require "underscore"
url = require "url"

download_package = 
module.exports.download_package = (params, options) ->
	options = _.defaults options || {},
		dest: "."
		redirect: (res) ->
		start: (res) ->
		data: (chunk) ->
		complete: () ->
		error: (err) ->

	if _.isString(params) then params = url.parse(params)
	params.method = "GET"

	req = https.request(params)
	name = null
	fstream = null
	dest = null

	req.on "response", (res) ->
		# Check for redirect
		if res.headers.location
			options.redirect res
			download_package res.headers.location, options
		else
			options.start res

			if _.has(res.headers, 'content-disposition')
				match = /filename=(\S+)/.exec(res.headers['content-disposition'])
				if match then name = match[1]

			unless name then name = path.basename(params.pathname)
			dest = path.resolve process.cwd(), options.dest, name

			res.on "error", options.error
			res.on "data", options.data
			res.on "end", () -> options.complete(dest)
			
			fstream = fs.createWriteStream dest, { flags: 'w', mode: 0o777 }
			res.pipe fstream

	req.end()

module.exports.fix_file = (file, find, replace, cb) ->
	fs.readFile file, "utf8", (err, data) ->
		if err then return cb(err)
		data = data.replace find, replace
		fs.writeFile file, data, cb