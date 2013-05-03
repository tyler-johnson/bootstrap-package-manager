# Dependencies
_ = require "underscore"
async = require "async"
path = require "path"
fs = require 'fs-extra'
request = require 'request'
EventEmitter = require("events").EventEmitter
targz = require 'tar.gz'
UglifyJS = require "uglify-js"
less = require 'less'
utils = require "./utils"

# Major Variables
BOOTSTRAP_URL = "https://github.com/twitter/bootstrap/archive/<%=version%>.tar.gz"
BOOTSTRAP_LESS_FILES = [ { file: "bootstrap.less", saveas: "bootstrap" }, { file: "responsive.less", saveas: "bootstrap-responsive" } ]

class AsyncTasks
	# Set up a task for an event
	on: (name, fnc) ->
		unless _.isObject(@_t) then @_t = {}

		unless _.isString(name) then throw new TypeError "Expecting a name for first argument."
		unless _.isFunction(fnc) then throw new TypeError "Expecting a function for second argument."
		unless _.has(@_t, name) then @_t[name] = []

		@_t[name].push fnc

	# fire an event asynchronously
	fire: (name, args..., cb) ->
		unless _.isObject(@_t) then @_t = {}

		unless queue = @_t[name] then throw new Error "#{name} event was not found."
		unless _.isArray(queue) and _.size(queue) then return cb()

		args.unshift name
		test = () => return _.size @_t[name]
		run = (callback) =>
			a = _.clone(args)
			a.push(callback)
			@_next.apply @, a
		
		async.whilst test, run,	cb

	# fire the next task in an event
	_next: (name, args..., cb) ->
		unless _.isObject(@_t) then @_t = {}

		queue = @_t[name]
		unless _.isArray(queue) and _.size(queue) then return false

		fnc = queue.shift()
		unless _.isFunction(fnc) then throw new TypeError "Task was not a function."

		done = (err) ->
			if _.isFunction(cb) then cb.apply null, arguments
			else if err then throw err
		args.push done

		try fnc.apply @, args
		catch e then done e

		return true

class BootstrapPackageManager extends AsyncTasks
	constructor: (dir, options = {}) ->
		@dir = path.resolve process.cwd(), dir or ""
		@options = _.defaults options,
			version: "master"
			parts: [ "img", "css", "less", "js" ]
			compress: [ "css", "js" ]
			concat: [ "js" ]
		@progress = new EventEmitter
		@runtime = null

		# Hook up primary tasks
		@init()

	init: () ->
		# Create the directory
		@on "setup", (next) ->
			@progress.emit "folder-setup"
			fs.mkdirs @dir, next # make the main directory

		# Download the tar file
		@on "download", (next) ->
			url = _.template BOOTSTRAP_URL, { version: @options.version }
			cur = 0
			len = 0

			utils.download_package url,
				dest: @dir
				start: (res) =>
					len = parseInt res.headers['content-length'], 10
					@progress.emit "download-start"
				data: (chunk) =>
					cur += chunk.length
					@progress.emit "download", cur / len
				complete: (dest) =>
					_.extend @runtime,
						url: url,
						archive: dest
					
					@progress.emit "download-end"
					next()
				error: next

		# unpackage the tar file
		@on "download", (next) ->
			@progress.emit "unarchive"
			
			archive = @runtime.archive
			
			# Set some runtime data
			_.extend @runtime,
				lib: path.join path.dirname(archive), path.basename(archive, ".tar.gz")

			# unarchive
			new targz().extract archive, @dir, next

		# Move the license
		@on "install", (next) ->
			fs.copy path.join(@runtime.lib, "LICENSE"), path.join(@dir, "LICENSE"), next

		# Move all folders
		@on "install", (next) ->
			@progress.emit "copy-parts"

			folders =
				js: { folder: "js", ext: ".js" },
				img: { folder: "img", ext: ".png" },
				less: { folder: "less", ext: ".less" }

			process = (part, cb) =>
				unless data = folders[part] then return cb()

				src = path.join @runtime.lib, data.folder
				dest = path.join @dir, data.folder

				# Delete the old folder
				fs.remove dest, (err) ->
					if err then return cb(err)

					# Copy the new one
					fs.copy src, dest, (err) ->
						if err then return cb(err)
						
						# Clean the folder
						fs.readdir dest, (err, files) ->
							if err then return cb(err)
							clean = (file, callback) ->
								unless path.extname(file) isnt data.ext then callback()
								else fs.remove path.join(dest, file), callback
							async.each files, clean, cb

			async.each @options.parts, process, next

		# Concat Javascript files
		@on "compile", (next) ->
			if _.contains(@options.parts, "js") then @progress.emit "compile-js"

			unless _.contains(@options.parts, "js") and _.contains(@options.concat, "js") then return next()
			folder = path.join(@dir, "js")

			# Get files
			fs.readdir folder, (err, files) ->
				if err then return cb(err)
				
				reduce = (memo, file, callback) ->
					file = path.join folder, file
					fs.readFile file, (err, data) ->
						if err then return callback(err)
						if memo then ret = Buffer.concat([ memo, data ])
						else ret = data
						callback null, ret

				# reduce into a single buffer
				async.reduce files, null, reduce, (err, data) ->
					if err then return next(err)
					
					# delete the folder
					fs.remove folder, (err) ->
						if err then return next(err)

						# create new one
						fs.mkdirs folder, (err) ->
							if err then return next(err)
							
							# write file
							fs.writeFile path.join(folder, "bootstrap.js"), data, next

		# Compress Javascript Files
		@on "compile", (next) ->
			unless _.contains(@options.parts, "js") and _.contains(@options.compress, "js") then return next()
			folder = path.join(@dir, "js")

			# Get files
			fs.readdir folder, (err, files) ->
				if err then return cb(err)

				compress = (file, callback) ->
					file = path.join folder, file
					result = UglifyJS.minify file

					ext = path.extname(file)
					name = path.basename(file, ext) + ".min" + ext
					newfile = path.join folder, name

					# write compress javascript
					fs.writeFile newfile, result.code, callback

				async.each files, compress, next

		# Compile/Compress CSS from Less
		@on "compile", (next) ->
			unless _.contains(@options.parts, "css") then return next()
			@progress.emit "compile-css"

			dir = @dir
			folder = path.join(@runtime.lib, "less")
			css_folder = path.join(dir, "css")
			compress = _.contains @options.compress, "css"

			# make css folder
			fs.mkdirs css_folder, (err) ->
				if err then return next(err)

				compile = (filedata, callback) ->
					file = path.join folder, filedata.file

					parser = new less.Parser
						paths: [ folder ],
						filename: filedata.file

					fs.readFile file, (err, data) ->
						if err then return next(err)

						parser.parse data.toString("utf8"), (err, tree) ->
							if err then return next(err)
							saveas = filedata.saveas or path.basename file, path.extname file
							base = path.join css_folder, saveas

							async.parallel [
								(cb) -> # Uncompressed
									output = tree.toCSS()
									fs.writeFile base + ".css", output, cb
								(cb) -> # Compressed
									unless compress then return cb()
									output = tree.toCSS { yuicompress: true }
									fs.writeFile base + ".min.css", output, cb
							], callback

				async.each BOOTSTRAP_LESS_FILES, compile, next

		# Delete unnecesary stuff
		@on "cleanup", (next) ->
			@progress.emit "cleanup"

			rm = _.values(_.pick(@runtime, "archive", "lib"))
			async.each rm, fs.remove, next

	run: (cb) ->
		events = [ "setup", "download", "install", "compile", "cleanup" ]
		@runtime = {}
		async.eachSeries events, @fire.bind(@), () ->
			@runtime = null
			cb.apply null, arguments

module.exports = BootstrapPackageManager