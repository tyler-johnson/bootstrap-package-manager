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
		complete: (dest) ->
		error: (err) ->

	error = _.once options.error
	if _.isString(params) then params = url.parse(params)

	if params.protocol is "https:" then http = require "https"
	else http = require "http"

	req = http.get params, (res) ->
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

			fstream = fs.createWriteStream dest, { flags: 'w', mode: 0o777 }
			fstream.on "error", error

			# Data
			res.on "data", options.data
			fstream.on "finish", () -> options.complete(dest)
			
			# Pipe
			res.pipe fstream

	req.on "error", error

module.exports.fix_file = (file, find, replace, cb) ->
	fs.readFile file, "utf8", (err, data) ->
		if err then return cb(err)
		data = data.replace find, replace
		fs.writeFile file, data, cb

module.exports.split = (str, sep) ->
	rawParts = str.split sep
	parts = []
	i = 0
	len = rawParts.length

	while i < len
		part = ""
		while rawParts[i].slice(-1) is "\\"
    		part += rawParts[i++].slice(0, -1) + sep  
    	parts.push part + rawParts[i]
    	i++
	
	return parts