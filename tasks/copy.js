'use strict';


module.exports = function copyto(grunt) {
    // Load task
    grunt.loadNpmTasks('grunt-contrib-copy');

    // Options
    return {
        build: {
          files: [{
                expand: true,
                dot: true,
                cwd: 'public',
                dest: 'dist',
                src: ['js/app.js']
            },
            {
                expand: true,
                dot: true,
                cwd: 'public',
                dest: 'dist',
                src: ['index.html']
            },
            {
                expand: true,
                dot: true,
                cwd: 'public/bower_components/font-awesome/',
                dest: 'dist',
                src: ['fonts/*.*']
            },
            {
                expand: true,
                dot: true,
                cwd: 'public/bower_components/leaflet/dist',
                dest: 'dist/style',
                src: ['images/*.*']
            }
          ]
        }
    };
};
