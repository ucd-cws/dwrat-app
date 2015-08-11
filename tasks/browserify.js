'use strict';


module.exports = function browserify(grunt) {
	// Load task
	grunt.loadNpmTasks('grunt-browserify');

	var files = {
		'public/js/app.js': ['lib/shared/index.js']
	};
	var browserifyOptions = {
		debug : true, // include source maps
		standalone : 'DWRAT'
	};

	// Options
	return {
		build: {
			files: files,
			options: {
				browserifyOptions : browserifyOptions
			}
		},
		watch : {
			files: files,
			options: {
				browserifyOptions : browserifyOptions,
				keepAlive : true,
				watch : true
			}
		}
	};
};
