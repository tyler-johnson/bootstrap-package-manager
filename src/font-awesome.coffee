# Dependencies
_ = require "underscore"
path = require "path"
fs = require "fs-extra"
targz = require 'tar.gz'
utils = require "./utils"
async = require "async"

# Major Variables
FONTAWESOME_URL = "https://github.com/FortAwesome/Font-Awesome/archive/<%=version%>.tar.gz"

module.exports = (BPM) ->
	# Options
	unless BPM.options["font-awesome"] then return
	options = _.defaults BPM.options["font-awesome"],
		path: null,
		version: "master"

	# Download Font Awesome
	BPM.on "download", (next) ->
		@progress.emit "fa-download-start"
		url = _.template FONTAWESOME_URL, { version: options.version }
		cur = 0
		len = 0
		
		utils.download_package url,
			dest: @dir
			start: (res) =>
				len = parseInt res.headers['content-length'], 10
			data: (chunk) =>
				cur += chunk.length
				@progress.emit "fa-download", cur / len
			complete: (dest) =>
				_.extend @runtime,
					fa_url: url,
					fa_archive: dest
				
				@progress.emit "fa-download-end"
				next()
			error: next

	# Unarchive font awesome
	BPM.on "download", (next) ->
		@progress.emit "fa-unarchive"
		
		archive = @runtime.fa_archive
		
		# Set some runtime data
		_.extend @runtime,
			fa_lib: path.join path.dirname(archive), path.basename(archive, ".tar.gz")

		# unarchive
		new targz().extract archive, @dir, next

	# Move less files into main lib *before* everything is moved
	BPM.on "download", (next) ->
		@progress.emit "fa-copy-less"
		to_folder = path.join(@runtime.lib, "less/font-awesome")
		@runtime.folders["less"].whitelist.push "font-awesome"

		fs.copy path.join(@runtime.fa_lib, "less"), to_folder, (err) =>
			if err then return next(err)

			async.parallel [
				(cb) => # fix font-awesome font path
					unless options.path then return cb()
					utils.fix_file path.join(to_folder, "variables.less"), /@FontAwesomePath(.*?);/i, "@FontAwesomePath: \"#{options.path}\";", cb
				(cb) => # fix bootstrap.less
					utils.fix_file path.resolve(to_folder, "../bootstrap.less"), "sprites.less", "font-awesome/font-awesome.less", cb
			], next

	# Move font files
	BPM.on "install", (next) ->
		@progress.emit "fa-copy-fonts"

		fs.copy path.join(@runtime.fa_lib, "font"), path.join(@dir, "font"), next

	# Clean up extra files
	BPM.on "cleanup", (next) ->
		@progress.emit "fa-cleanup"

		rm = _.values _.pick @runtime, "fa_archive", "fa_lib"
		async.each rm, fs.remove, next