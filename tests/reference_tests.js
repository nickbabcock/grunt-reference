var reference = require('../lib/reference.js');
var fs = require('fs');
var jsdom = require('jsdom');
var _ = require('underscore');
var html = function(html, callback) {
    jsdom.env({
        scripts: ['//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js'],
        html: html,
        done: callback
    });
};

exports['test'] = {
    'cite elements': function(test) {
        html('<cite>1</cite><cite>2</cite>', function(errors, window) {
            test.equal(reference.getCitableElements(window).length, 2);
            test.done();
        })
    },
    'cite attributes': function(test) {
        html('<span cite="1"/><q cite="2"></q>', function(errors, window) {
            test.equal(reference.getCitableElements(window).length, 2);
            test.done();
        });
    },
    'whitespace trim': function(test) {
        html('<cite> 1    </cite><span cite="  2  "/>', function(errors, window) {
            var actual = reference.getCitableElements(window);
            test.equal(reference.text(actual[0]), '1');
            test.equal(reference.text(actual[1]), '2');
            test.done();
        });
    },

    'url is http': function(test) {
        var url = 'http://www.google.com';
        test.ok(reference.isUrl(url));
        test.done();
    },
    'url is https': function(test) {
        var url = 'https://www.google.com';
        test.ok(reference.isUrl(url));
        test.done();
    },
    'url is not isbn': function(test) {
        var url = '9780201633610'
        test.ok(!reference.isUrl(url));
        test.done();
    },

    'periodical': function(test) {
        var str = '10.1109/TSE.2008.36';
        test.ok(reference.isPeriodical(str));
        test.done();
    },

    'isbn': function(test) {
        var str = '9780735619678'
        test.ok(reference.isISBN(str));
        test.done();
    },
    
    'ibid': function(test) {
        var arr = ['1', '1', '2', '2', '1'];
        var expected = [false, true, false, true, false];
        test.deepEqual(reference.getIbids(arr), expected);
        test.done();
    },

    'isbn lookup': function(test) {
        var str = '9780201633610 100';
        var expected = '9780201633610';

        test.equal(expected, reference.lookup(str));
        test.done();
    }
};
