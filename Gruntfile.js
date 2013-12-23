module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        jshint: {
            all: ['Gruntfile.js', 'tasks/*.js'],
            options: {
                curly: true,
                eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                undef: true,
                boss: true,
                eqnull: true,
                node: true
            }       
        },
        nodeunit: {
            all: ['tests/reference_tests.js']
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-nodeunit');

    grunt.registerTask('default', ['jshint']);
};
