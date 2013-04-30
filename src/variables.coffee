fs = require "fs-extra"
path = require "path"

module.exports = (BPM) ->
	# Variable Path
	unless file = BPM.options["variables.less"] then return
	
	BPM.on "install", (next) ->
		@progress.emit "variables-copy"

		src = path.resolve process.cwd(), file
		dest = path.join @dir, "less", "variables.less"

		fs.copy src, dest, next