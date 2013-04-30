coffee = require "coffee-script"
async = require "async"
fs = require "fs"
path = require "path"

task 'build', 'Build source coffee files to javascript.', () ->
	base = process.cwd()
	src_folder = path.join base, "src"

	fs.readdir src_folder, (err, files) ->
		if err then return console.error err
		
		process = (file, callback) ->
			src = path.join src_folder, file
			basename = path.basename file, path.extname file

			dest = path.join "lib", basename + ".js"
			if basename is "bin" then dest = path.join "bin", "bpm"
			dest = path.join base, dest

			fs.readFile src, (err, data) ->
				if err then return callback err

				source = coffee.compile data.toString("utf8"), { filename: path.basename(dest) }
				if basename is "bin" then source = "#!/usr/bin/env node\n\n" + source
				fs.writeFile dest, source, (err) ->
					if err then return callback err
					fs.chmod dest, 0o755, callback

		async.each files, process, (err) ->
			if err then return console.error err
			else console.log "Done."