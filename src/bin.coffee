timer = new Date

###
Dependencies
###
BootstrapPackageManager = require '../lib/main'
ProgressBar = require 'progress'
_ = require "underscore"
program = require 'commander'

###
Program Stuff
###
program
	.version('1.1.0')
	.usage('[options] <dir>')
	.option('-j, --js', 'Add Javascript')
	.option('-c, --css', 'Add CSS')
	.option('-l, --less', 'Add Less')
	.option('-i, --img', 'Add Images')
	.option('-a, --font-awesome', "Add Font Awesome")
	.option('-v, --variables <path>', "Path to a custom `variables.less` file to replace the included version.")
	.option('-f, --font-path <path>', "Set a custom value for the less variable `@FontAwesomePath` for a custom css font path when using Font Awesome.")
	.option('-x, --compress', "Compress JS and CSS and include as  an extra \"*.min.*\" file.")
	.option('--compress-js', "Compress JS with UglifyJs and include as an extra \"*.min.js\" file.")
	.option('--compress-css', "Compress CSS with lessc (YUI) and include as an extra \"*.min.css\" file.")
	.option('--no-concat', "Don't concat Javascript files together.")
	.option('--bootstrap-version <version>', "Specific Bootstrap version to use. See http://github.com/twitter/bootstrap/tags for full list.")
	.option('--font-awesome-version <version>', "Specific Font Awesome version to use. See http://github.com/FortAwesome/Font-Awesome/tags for full list.")
	
program.on '--help', () ->
	console.log('  Note: The default is to include all javascript, css, images and less unless you include at least one of the options `-j`, `-c`, `-l`, or `-i`, in which case only those specified are included.')
	console.log('')

program.parse(process.argv);

###
Options Set Up
###
o = {}

# Bootstrap Version
o.version = "master"
if program.bootstrapVersion then o.version = BOOTSTRAP_VERSION
if o.version isnt "master" and o.version.substr(0, 1) isnt "v" then o.version = "v" + o.version

# Parts to Include
parts = [ "img", "css", "less", "js" ]
o.parts = _.filter parts, (part) -> return program[part]
if _.isEmpty(o.parts) then o.parts = parts

# Compression
o.compress = []
if program.compress or program.compressCss then o.compress.push "css"
if program.compress or program.compressJs then o.compress.push "js"

# Concatenation
o.concat = []
if program.concat then o.concat.push "js"

# Font Awesome
if program.fontAwesome
	fa = o["font-awesome"] = {}
	if program.fontPath then fa.path = program.fontPath
	if program.fontAwesomeVersion then fa.version = program.fontAwesomeVersion
	if fa.version and fa.version.substr(0, 1) isnt "v" then fa.version = "v" + fa.version

# Variables.less
o["variables.less"] = program.variables or null

###
The Manager
###
BPM = new BootstrapPackageManager _.first(program.args), o

###
The Extras
###
_.each [ "font-awesome", "variables" ], (f) -> require("../lib/#{f}")(BPM)

###
Display
###
bar = null
events =
	# Main
	"folder-setup": "\nInitiating...\n"
	"download-start": () ->
		console.log "Downloading Bootstrap..."
		bar = new ProgressBar '[:bar] :percent :etas',
			width: 50,
			total: 1,
			incomplete: " "
	"download": (amt) ->
		bar.tick amt
	"download-end": ""
	"unarchive": "Unpacking Bootstrap...\n"
	"copy-parts": "Moving Files...\n"
	"compile-js": "Compiling Javascript..."
	"compile-css": "Compiling CSS..."
	"cleanup": "\nCleaning Up..."

	# Font Awesome
	"fa-download-start": () ->
		console.log "Downloading Font-Awesome..."
		bar = new ProgressBar '[:bar] :percent :etas',
			width: 50,
			total: 1,
			incomplete: " "
	"fa-download": (amt) ->
		bar.tick amt
	"fa-download-end": ""
	"fa-unarchive": "Unpacking Font Awesome...\n"
	"fa-copy-parts": "Installing Font Awesome..."

	# Variables.less
	"variables-copy": "Copying custom variables.less..."

_.each events, (e, name) ->
	if _.isString(e)
		log = e
		e = () -> console.log log
	BPM.progress.on name, e

###
Error Catch
###
process.on 'uncaughtException', (err) ->
	console.log "\n\nBPM crashed with the following error:\n"
	console.error(err.stack)
	process.exit(1)

###
Run
###
BPM.run (err) ->
	if err then throw err
	else
		time = Math.round (new Date - timer) / 1000
		console.log "\nDone in #{time}s."
		process.exit(0)