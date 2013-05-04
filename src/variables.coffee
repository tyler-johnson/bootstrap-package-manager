fs = require "fs-extra"
path = require "path"

module.exports = (BPM) ->
	# Variable Path
	unless file = BPM.options["variables.less"] then return
	
	# Move less files into main lib *before* everything is moved
	BPM.on "download", (next) ->
		@progress.emit "variables-copy"

		src = path.resolve process.cwd(), file
		dest = path.join @runtime.lib, "less", "variables.less"

		fs.copy src, dest, next