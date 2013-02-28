var time = new Date(),
	program = require('commander'),
	_ = require('underscore'),
	path = require('path'),
	url = require('url'),
	fs = require('fs-extra'),
	https = require('https'),
	promise = require("fibers-promise"),
	targz = require('tar.gz'),
	less = require('less'),
	UglifyJS = require("uglify-js"),
	ProgressBar = require('progress');

// Master variables
var BOOTSTRAP_URL = "https://github.com/twitter/bootstrap/archive/<%=version%>.tar.gz",
	BOOTSTRAP_VERSION = "master",
	FONTAWESOME_URL = "https://github.com/FortAwesome/Font-Awesome/archive/<%=version%>.tar.gz",
	FONTAWESOME_VERSION = "master",
	EVERYTHING = true;

// Program Stuff
program
	.version('1.0.0')
	.usage('[options] <output>')
	.option('-j, --javascript', 'Add Javascript')
	.option('-c, --css', 'Add CSS')
	.option('-l, --less', 'Add Less')
	.option('-i, --images', 'Add Images')
	.option('-a, --font-awesome', "Add Font Awesome")
	.option('--no-concat', "Don't concat Javascript files together. JS compression not available with this option.")
	.option('-x, --compress', "Compress JS and CSS and include as a \"*.min.*\" file.")
	.option('--compress-js', "Compress JS with UglifyJs and include as a \"bootstrap.min.js\" file.")
	.option('--compress-css', "Compress CSS with lessc (YUI) and include as a \"*.min.css\" file.")
	.option('--bootstrap-version [version]', "Specific Bootstrap version to use. See http://github.com/twitter/bootstrap/tags for full list.")
	.option('--font-awesome-version [version]', "Specific Font Awesome version to use. See http://github.com/FortAwesome/Font-Awesome/tags for full list.")
	
program.on('--help', function(){
  console.log('  Examples:');
  console.log('');
  console.log('    $ bsp bootstrap');
  console.log('    $ custom-help -h');
  console.log('');
});

program.parse(process.argv);

// Set default versions
if (!program.bootstrapVersion) program.bootstrapVersion = BOOTSTRAP_VERSION;
else if (program.bootstrapVersion.substr(0, 1) !== "v") program.bootstrapVersion = "v" + program.bootstrapVersion;

if (!program.fontAwesomeVersion) program.fontAwesomeVersion = FONTAWESOME_VERSION;
else if (program.fontAwesomeVersion.substr(0, 1) !== "v") program.fontAwesomeVersion = "v" + program.fontAwesomeVersion;

// Helpers
function download_package(params, options) {
	options = _.defaults(options || {}, {
		dest: ".",
		redirect: function(res) {},
		start: function(res) {},
		data: function(chunk) {},
		complete: function() {},
		error: function(err) {}
	});

	if (_.isString(params)) params = url.parse(params);
	params.method = "GET";

	var req = https.request(params),
		name, fstream, dest;

	req.on("response", function(res) {
		// Check for redirect
		if (res.headers.location) {
			options.redirect(res);
			download_package(res.headers.location, options);
		} else {
			options.start(res);

			if (_.has(res.headers, 'content-disposition')) {
				var match = /filename=(\S+)/.exec(res.headers['content-disposition']);
				if (match) name = match[1];
			}

			if (!name) name = path.basename(params.pathname);
			dest = path.resolve(__dirname, options.dest, name);

			res.on("error", options.error);
			res.on("data", options.data);
			res.on("end", function() { options.complete(dest) });
			
			fstream = fs.createWriteStream(dest, { flags: 'w', mode: 0777 });
			res.pipe(fstream);
		}
	});

	req.end();
}

function fix_file(file, find, replace, cb) {
	var data = fs.readFileSync(file).toString();
	data = data.replace(find, replace);

	var fstream = fs.createWriteStream(file, { flags: "w" });
	
	fstream.on("close", cb);
	fstream.on("error", cb);

	fstream.end(data);
}

function fa_copy_fix(folder, dest, cb) {
	var src = path.join(folder, "less");

	fs.copy(src, dest, function(err) {
		if (err) cb(err);
		else {
			fix_file(path.join(dest, "bootstrap.less"), "sprites.less", "font-awesome.less", function(err) {
				if (err) cb(err);
				else cb();
			});
		}
	});
}

function compile_less(file, dest, compress, cb) {
	var data = fs.readFileSync(file).toString(),
		ouput, fstream,
		parser = new(less.Parser)({
			paths: [ path.dirname(file) ],
			filename: path.basename(file)
		});

	parser.parse(data, function(e, tree) {
		if (e) cb(e);
		else {
			output = tree.toCSS({ yuicompress: compress });
			fstream = fs.createWriteStream(dest, { flags: "w" });

			fstream.on("close", cb);
			fstream.on("error", cb);

			fstream.end(output);
		}
	});
}

// Determine if we should get everything
var get = [ "javascript", "images", "less", "css" ];
_.some(get, function(item) {
	if (program[item]) return !(EVERYTHING = false);
})

// PROGRAM START
promise.start(function() {
	var stats, location, folder, create, p, fsize, stats,
		bar, err, boot_url, boot_dest, fa_url, fa_dest;

	// Find or make the folder
	location = path.resolve(process.cwd(), _.first(program.args));
	folder = path.basename(location);
	create = false;
	p = promise();

	// If something by that name exists
	if (fs.existsSync(location)) {
		stats = fs.statSync(location);

		// Check if its a directory
		if (stats.isDirectory()) {
			fsize = _.size(fs.readdirSync(location));

			// Check if its empty
			if (!fsize) create = false;
			else {
				program.confirm(folder + ' exists and is non-empty. continue? ', p);
				if (!p.get()) process.exit(1);
			}
		} else create = true;
	} else create = true;

	// If we need to create it, do that
	if (create) fs.mkdirSync(location);

	// Download the main package
	boot_url = _.template(BOOTSTRAP_URL, { version: program.bootstrapVersion });

	console.log('');
	console.log('Downloading Bootstrap...');
	
	download_package(boot_url, {
		dest: folder,
		start: function(res) {
			if (res.statusCode >= 400 && res.statusCode < 600) throw new Error("Bootstrap "+program.bootstrapVersion+" could not be found.");

			var len = parseInt(res.headers['content-length'], 10);
			bar = new ProgressBar('[:bar] :percent :etas', {
				width: 50,
				total: len,
				incomplete: " "
			});
		},
		data: function(chunk) {
			bar.tick(chunk.length);
		},
		complete: function(dest) {
			console.log('\nInstalling Bootstrap...');
			new targz().extract(dest, folder, function(err) {
				if (err) throw err;
				else {
					fs.unlinkSync(dest); // Delete tar file
					p(path.join(path.dirname(dest), path.basename(dest, ".tar.gz")));
				}
			});
		},
		error: function(err) { throw err; }
	});
	
	boot_dest = p.get();

	// Get main packages
	var get = {
		"javascript": { folder: "js", ext: ".js" },
		"images": { folder: "img", ext: ".png" },
		"less": { folder: "less", ext: ".less" }
	};
	
	_.each(get, function(data, key) {
		if (program[key] || EVERYTHING) {
			var src = path.join(boot_dest, data.folder),
				dest = path.join(folder, data.folder);

			// Delete the folder
			fs.remove(dest, p);
			if (err = p.get()) throw err;

			// Copy the new one
			fs.copy(src, dest, p);
			if (err = p.get()) throw err;

			// Clean folders
			var files = fs.readdirSync(dest);
			_.each(files, function(file) {
				if (path.extname(file) !== data.ext) {
					fs.remove(path.join(dest, file), p);
					if (err = p.get()) throw err;
				}
			});
		}
	});

	console.log('');
	
	// Download font awesome if we need to
	if (program.fontAwesome) {
		fa_url = _.template(FONTAWESOME_URL, { version: program.fontAwesomeVersion });

		console.log('Downloading Font Awesome...');

		download_package(fa_url, {
			dest: folder,
			start: function(res) {
				if (res.statusCode >= 400 && res.statusCode < 600) throw new Error("Font Awesome "+program.fontAwesomeVersion+" could not be found.");

				var len = parseInt(res.headers['content-length'], 10);
				bar = new ProgressBar('[:bar] :percent :etas', {
					width: 50,
					total: len,
					incomplete: " "
				});
			},
			data: function(chunk) {
				bar.tick(chunk.length);
			},
			complete: function(dest) {
				console.log('\nInstalling Font Awesome...');
				new targz().extract(dest, folder, function(err) {
					if (err) throw err;
					else {
						fs.unlinkSync(dest); // Delete tar file
						p(path.join(path.dirname(dest), path.basename(dest, ".tar.gz")));
					}
				});
			},
			error: function(err) { throw err; }
		});

		fa_dest = p.get();

		// Copy font folder
		fs.copy(path.join(fa_dest, "font"), path.join(folder, "font"), p);
		if (err = p.get()) throw err;

		// If less is enabled, copy over the correct file
		if (program.less || EVERYTHING) {
			fa_copy_fix(fa_dest, path.join(folder, "less"), p);
			if (err = p.get()) throw err;
		}

		// Do the same as above but on the source
		fa_copy_fix(fa_dest, path.join(boot_dest, "less"), p);
		if (err = p.get()) throw err;

		console.log('');
	}

	// Deal with CSS files
	if (program.css || EVERYTHING) {
		console.log('Compiling CSS...');

		// Create CSS Folder
		var css_folder = path.join(folder, "css");
		if (!fs.existsSync(css_folder) || !fs.statSync(css_folder).isDirectory()) fs.mkdirSync(css_folder);

		compile_less(path.join(boot_dest, "less/bootstrap.less"), path.join(css_folder, "bootstrap.css"), false, p);
		if (err = p.get()) throw err;

		compile_less(path.join(boot_dest, "less/responsive.less"), path.join(css_folder, "bootstrap-responsive.css"), false, p);
		if (err = p.get()) throw err;

		if (program.compress || program.compressCss) {
			compile_less(path.join(boot_dest, "less/bootstrap.less"), path.join(css_folder, "bootstrap.min.css"), true, p);
			if (err = p.get()) throw err;

			compile_less(path.join(boot_dest, "less/responsive.less"), path.join(css_folder, "bootstrap-responsive.min.css"), true, p);
			if (err = p.get()) throw err;
		}
	}

	// Deal with JS concat and compress
	if ((program.javascript || EVERYTHING) && program.concat) {
		console.log('Compiling Javascript...');

		var src = path.join(folder, "js"), code,
			files = fs.readdirSync(src),
			compress = program.compress || program.compressJs;

		code = _.reduce(files, function(memo, file) {
			var full = path.join(src, file);
			return memo + fs.readFileSync(full).toString();
		}, "");

		// Delete the folder
		fs.remove(src, p);
		if (err = p.get()) throw err;

		// Re make the folder
		fs.mkdirSync(src);

		// Write file
		fstream = fs.createWriteStream(path.join(src, "bootstrap.js"), { flags: "w" });
		fstream.on("close", p);
		fstream.on("error", function(err) { throw err; });
		fstream.end(code);
		if (err = p.get()) throw err;

		// Do compression
		if (compress) {
			code = UglifyJS.minify(code, { fromString: true }).code;

			fstream = fs.createWriteStream(path.join(src, "bootstrap.min.js"), { flags: "w" });
			fstream.on("close", p);
			fstream.on("error", function(err) { throw err; });
			fstream.end(code);
			if (err = p.get()) throw err;
		}
	}

	console.log('Cleaning up...');

	// Delete temp folders
	fs.remove(boot_dest, p);
	if (err = p.get()) throw err;

	if (fa_dest) {
		fs.remove(fa_dest, p);
		if (err = p.get()) throw err;
	}

	console.log('');
	console.log('Done in ' + Math.round((new Date() - time) / 1000) + 's.');

	// Make sure we exit
	process.exit(1);
});