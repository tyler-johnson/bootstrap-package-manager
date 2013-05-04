# Bootstrap Package Manager

This is a simple command line interface for installing and compiling Twitter Bootstrap written in Node.js. It has many options, but the default is to install everything, without compression. It also integrates with a few extra Bootstrap resources, including Font-Awesome and Bootswatch themes.

## Install

	npm install bootstrap-package-manager -g

## Usage

	bpm [options] <folder>

Both `options` and `folder` are optional. `folder` is the path you want to dump the bootstrap files in and defaults to `./bootstrap`. If the directory already exists and isn't empty, bootstrap-package-manager will warn you. Here are available options:

* `-h, --help` : output usage information
* `-V, --version` : output the version number
* `-j, --javascript` : Add Javascript
* `-c, --css` : Add CSS
* `-l, --less` : Add Less
* `-i, --img` : Add Images
* `-a, --font-awesome` : Add Font Awesome
* `-t, --theme <name>` : Mixin in a Bootswatch theme. See <http://bootswatch.com/> for full list. Compatible with custom variables.less file.
* `-v, --variables <path>` : Path to a custom `variables.less` file to replace the included version.
* `-f, --font-path <path>` : Set a custom value for the less variable `@FontAwesomePath` for a custom css font path when using Font Awesome.
* `-s, --script <paths>` : Include javascript files (seperated by commas) with custom runtime instructions. See `src/font-awesome.coffee` or `src/variables.coffee` for examples.
* `-x, --compress` : Compress JS and CSS and include as an extra `*.min.*` file.
* `--compress-js` : Compress JS with UglifyJs and include as  an extra `bootstrap.min.js` file.
* `--compress-css` : Compress CSS with lessc (YUI) and include as an extra `*.min.css` file.
* `--no-concat` : Don't concat Javascript files together. JS compression not available with this option.
* `--bootstrap-version <version>` : Specific Bootstrap version to use. See <http://github.com/twitter/bootstrap/tags> for full list. Default: `master`; Example: `2.1.0` or `v2.1.0`
* `--font-awesome-version <version>` : Specific Font Awesome version to use. See <http://github.com/FortAwesome/Font-Awesome/tags> for full list. Default: `master`; Example: `3.0.0` or `v3.0.0`

The default is to include all javascript, css, images and less unless you include at least one of the options `-j`, `-c`, `-l`, or `-i`, in which case only those specified are included.

Sometimes, bootstrap-package-manager likes to... fail. It is usually caused by a problem with http requests or file streams (ie. a package url is offline). If this happens, attempt a few reruns and then if the problem still occurs, submit an issue report.

## Examples

	$ bpm

Creates a new folder in the current working directory named "bootstrap" and dumps js, css, less and images into it.

	$ bpm -ax

Creates a new folder in the current working directory named "bootstrap" and dumps js, css, less, images and font awesome into it. Then it compresses all of the css and js.

	$ bpm -jcix booten_gurt

Creates a new folder in the current working directory named "booten_gurt" and dumps only js, css, and images into it. Then it compresses all of the css and js.

	$ bpm -x -v ./variables.less

Creates a new folder in the current working directory named "bootstrap" and dumps js, css, images and less files into it. Then it replaces the existing variables.less file with the custom one and compresses all of the css and js.

	$ bpm --bootstrap-version 2.1.0

Creates a new folder in the current working directory named "bootstrap", gets version 2.1.0 of bootstrap and dumps only js, css, less, and images into it.

	$ bpm -t Cosmo

Creates a new folder in the current working directory named "bootstrap", finds and includes the Bootswatch theme `Cosmo` and then exports the js, css, less, and images.