# Bootstrap Package Manager

This is a simple command line interface for installing and compiling Twitter Bootstrap written in Node.js. It has many options, but the default is to install everything, without compression. It can also automatically include Font-Awesome.

## Install

	npm install bootstrap-package-manager -g

## Usage

	bpm [options] <folder>

`options` are optional, but `folder` is required and is the path you want to create bootstrap at. If it already exists and isn't empty, bootstrap-package-manager will warn you. Here are available options:

* `-h, --help` : output usage information
* `-V, --version` : output the version number
* `-j, --javascript` : Add Javascript
* `-c, --css` : Add CSS
* `-l, --less` : Add Less
* `-i, --images` : Add Images
* `-a, --font-awesome` : Add Font Awesome
* `-v, --variables <path>` : Path to a custom `variables.less` file to replace the included version.
* `-f, --font-path <path>` : Set a custom value for the less variable `@FontAwesomePath` for a custom css font path when using Font Awesome.
* `-x, --compress` : Compress JS and CSS and include as an extra `\*.min.\*` file.
* `--compress-js` : Compress JS with UglifyJs and include as  an extra `bootstrap.min.js` file.
* `--compress-css` : Compress CSS with lessc (YUI) and include as an extra `\*.min.css` file.
* `--no-concat` : Don't concat Javascript files together. JS compression not available with this option.
* `--bootstrap-version <version>` : Specific Bootstrap version to use. See <http://github.com/twitter/bootstrap/tags> for full list. Default: `master`; Example: `2.1.0` or `v2.1.0`
* `--font-awesome-version <version>` : Specific Font Awesome version to use. See <http://github.com/FortAwesome/Font-Awesome/tags> for full list. Default: `master`; Example: `3.0.0` or `v3.0.0`

The default is to include all javascript, css, images and less unless you include at least one of the options `-j`, `-c`, `-l`, or `-i`, in which case only those specified are included.

## Examples

	bpm bootstrap

Creates a new folder in the current working directory named "bootstrap" and dumps js, css, less and images into it.

	bpm -ax bootstrap

Creates a new folder in the current working directory named "bootstrap" and dumps js, css, less, images and font awesome into it. Then it compresses all of the css and js.

	bpm -jcix bootstrap

Creates a new folder in the current working directory named "bootstrap" and dumps only js, css, and images into it. Then it compresses all of the css and js.

	bpm -x -v ./variables.less bootstrap

Creates a new folder in the current working directory named "bootstrap" and dumps js, css, images and less files into it. Then it replaces the existing variables.less file with the custom one and compresses all of the css and js.

	bpm --bootstrap-version 2.1.0 bootstrap

Creates a new folder in the current working directory named "bootstrap", gets version 2.1.0 of bootstrap and dumps only js, css, less, and images into it.