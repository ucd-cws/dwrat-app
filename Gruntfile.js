'use strict';


module.exports = function (grunt) {

    // Load the project's grunt tasks from a directory
    require('grunt-config-dir')(grunt, {
        configDir: require('path').resolve('tasks')
    });


    // grunt-config-dir does not play nice with usemin
    // so manually loading usemin lib's and setting config here
    grunt.loadNpmTasks('grunt-usemin');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-filerev');

    grunt.config.merge({
      useminPrepare: {
          html: ['public/index.html'],
          options: {
            dest: 'dist',
            verbose: true
          }
      },
      usemin: {
          html: ['dist/index.html'],
    			options: {
    				assetsDirs: ['dist']
          }
      }
    });
    // end usemin

    // Register group tasks
    grunt.registerTask('build', [
      'clean',
      'browserify:build',
      'copy',
        // usemin start
        'useminPrepare',
        'concat:generated',
        'cssmin:generated',
        'uglify:generated',
        'usemin',
        // usemin end
      ]);

};
