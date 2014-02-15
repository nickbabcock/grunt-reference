var reference = require('../lib/reference.js');
var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');
var _ = require('underscore');

exports['test'] = {
    'cite elements': function(test) {
        $ = cheerio.load('<cite>1</cite><cite>2</cite>');
        test.equal(reference.getCitableElements($).length, 2);
        test.done();
    },
    'cite attributes': function(test) {
        $ = cheerio.load('<span cite="1"/><q cite="2"></q>');
        test.equal(reference.getCitableElements($).length, 2);
        test.done();
    },
    'whitespace trim': function(test) {
        $ = cheerio.load('<cite> 1    </cite><span cite="  2  "/>');
        var actual = reference.getCitableElements($);
        test.equal(reference.text(actual[0]), '1');
        test.equal(reference.text(actual[1]), '2');
        test.done();
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
