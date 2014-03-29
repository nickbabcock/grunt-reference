module.exports = function(grunt) {
    'use strict';

    var path = require('path');
    var fs = require('fs');
    var request = require('request');
    var async = require('async');
    var _ = require('underscore');
    var reference = require('../lib/reference.js');
    var cheerio = require('cheerio');
    var googleCache = path.resolve('./.grunt/grunt-reference/google');
    var periodCache = path.resolve('./.grunt/grunt-reference/period');
    var jsdom = require('jsdom');

    var createD3Graph = function(d3, elem, data) {
        var barHeight = 28;
        var marginHeight = 53;
        var tickCount = 5;

        var numData = data.map(function(e) { return e.count; } );

        var x = d3.scale.linear()
            .domain([0, d3.max(numData)])
            .range([0, 400]);

        var chart = d3.select(elem)
            .append('svg')    
            .attr('width', 700)
            .attr('height', barHeight * data.length + marginHeight)
            .attr('class', 'chart')
            .append('g')
            .attr('transform', 'translate(230, 43)');


        chart.selectAll('rect')
            .data(numData)
            .enter()
            .append('rect')
            .attr('y', function(d, i) {return i * barHeight; })
            .attr('width', x)
            .attr('height', barHeight);

        //Add bar text
        chart.selectAll('text')
            .data(numData)
            .enter()
            .append('text')
            .attr('x', x)
            .attr('y', function(d, i) { return i * barHeight + (barHeight / 2); })
            .attr('dx', -3)
            .attr('dy', '.35em')
            .attr('class', 'innerText')
            .text(String);


        //Add ticks
        chart.selectAll('line')
            .data(x.ticks(tickCount))
            .enter().append('line')
            .attr('x1', x)
            .attr('x2', x)
            .attr('y1', 0)
            .attr('y2', barHeight * data.length)
            .style('stroke', '#ccc');

        //Add tick label
        chart.selectAll('.rule')
            .data(x.ticks(tickCount))
            .enter()
            .append('text')
            .attr('class', 'rule')
            .attr('x', x)
            .attr('y', 0)
            .attr('dy', -3)
            .attr('text-anchor', 'middle')
            .text(String);

        //Add line to the base the of the chart
        chart.append('line')
            .attr('y1', 0)
            .attr('y2', barHeight * data.length)
            .style('stroke', '#000');

        //Add bar text
        chart.selectAll('text')
            .data(data, function(d) { return d.title; })
            .enter()
            .append('text')
            .attr('x', -12)
            .attr('y', function(d, i) { return i * barHeight + (barHeight / 2); })
            .attr('dx', -3)
            .attr('dy', '.35em')
            .attr('class', 'bookText')
            .text(function(d, i) { 
                if (d.title.length > 22) {
                    return d.title.substr(0, 22) + '…';
                }
                    return d.title; 
                });

        //bar title
        chart.append('text')
            .attr('y', -28)
            .attr('class', 'charTitle')
            .text('Citations per Book');
    };

    grunt.registerMultiTask('renderReferencePage', function() {
        var task = this;
        var done = this.async();
        var jqueryPath = path.resolve(path.join(__dirname, '../vendor/jquery.min.js'));
        var d3Path = path.resolve(path.join(__dirname, '../vendor/d3.min.js'));
        var src = this.filesSrc;

        // Read all the html rendered pages and sniff out just the ISBN
        // numbers. Group all the ISBN numbers and then read their
        // corresponding cached page. Finally render the reference page with
        // the resulting data.
        async.parallel([
            fs.readFile.bind(fs, jqueryPath, 'utf8'),
            fs.readFile.bind(fs, d3Path, 'utf8'),
            async.map.bind(async, src, _.partial(fs.readFile, _, 'utf8', _))
        ], function(err, results) {
            if (err) {
                grunt.fail.fatal(err);
            }
            
            var jquery = results[0];
            var d3 = results[1];
            results = results[2];

            var elements = _.chain(results).map(function(str) {
                    return reference.getCitableElements(cheerio.load(str));
                }).flatten()
                .filter(reference.iseISBN)
                .map(reference.text).map(reference.lookup)
                .groupBy(function(isbn) { return isbn; })
                .value();

            var outputPath = path.resolve(task.data.referencePage);
            async.parallel([
                function(cb) {
                    jsdom.env({
                        file: outputPath,
                        src: [jquery, d3],
                        done: cb
                    });
                },
                async.map.bind(async, _.keys(elements).map(function(isbn) {
                    return path.join(googleCache, isbn + '.json'); 
                }), function(val, cb) { fs.readFile(val, 'utf8', cb); })
            ], function(err, results) {
                var window = results[0];
                var contents = results[1];
                var keys = _.keys(elements);
                elements = _.chain(elements).map(function(list, isbn) {
                    var content = contents[keys.indexOf(isbn)];
                    var json = JSON.parse(content).items[0];
                    return {
                        count: list.length,
                        title: json.volumeInfo.title,
                        authors: json.volumeInfo.authors,
                        description: json.volumeInfo.description,
                        publishedDate: json.volumeInfo.publishedDate,
                        publisher: json.volumeInfo.publisher,
                        image: json.volumeInfo.imageLinks.thumbnail
                    };
                }).sortBy('title').reverse()
                .sortBy('count').reverse()
                .value();

                var $ = window.$;
                var templ = _.template($('#referencePageTmpl').html());
                var placeholder = $('div.Product');
                createD3Graph(window.d3, placeholder[0], elements);
                placeholder.append($('<div>').html(templ({references: elements })));

                $('script.jsdom').remove();
                fs.writeFile(outputPath,
                    window.document.doctype + window.document.innerHTML, done);
            });
        });
    });

    var makeRequests = function(url, cachePath, arr, callback) {
        var func = function(val, callback) {
            val = reference.lookup(reference.text(val));
            var cache = path.join(cachePath, val.replace('/', '-')  + '.json');
            fs.exists(cache, function(cacheExists) {
                if (cacheExists) {
                    fs.readFile(cache, 'utf8', callback);
                }
                else {
                    request(url + val, function(error, response, body) {
                        fs.writeFile(cache, body, function() {
                            callback(null, body);
                        });
                    });
                }
            });
        };

        async.map(arr, func, function(err, results) { callback(null, results); });
    };

    grunt.registerMultiTask('reference', function() {
        var task = this;
        var done = this.async();
        var src = _.map(this.filesSrc, function(val) { return path.resolve(val); });

        async.each(src, function(filepath, callback) {
            async.waterfall([
                fs.readFile.bind(fs, filepath, 'utf8'), 
                function(str, cb) {
                    var $ = cheerio.load(str);
                    var elements = reference.getCitableElements($);

                    async.parallel([
                        function(callback) {
                            var periodicals = elements.filter(reference.isePeriodical);
                            var url = 'http://api.altmetric.com/v1/doi/'; 
                            makeRequests(url, periodCache, periodicals, callback);
                        },
                        function(callback) {
                            var google = elements.filter(reference.iseISBN);
                            var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:';
                            makeRequests(url, googleCache, google, callback);
                        },
                        function(callback) {
                            var urls = elements.filter(reference.iseUrl);
                            urls = urls.map(function(val) {
                                return reference.text(val);
                            });
                            
                            callback(null, urls);
                        }
                    ], function(err, results) {
                        cb(err, results, $, elements);
                    });
                },
                function(results, $, elements, cb) {
                    var parseJson = function(val) { return JSON.parse(val); };
                    results[0] = results[0].map(function(val) {
                        return reference.parsePeriodical(parseJson(val));
                    });

                    results[1] = results[1].map(function(val) {
                        return reference.parseGoogle(parseJson(val));
                    });
                    
                    results = _.flatten(results);
                    results = _.zip(results,
                        elements.filter(reference.isePeriodical).concat(
                            elements.filter(reference.iseISBN)).concat(
                            elements.filter(reference.iseUrl)));

                    var container = $('#references');
                    var elementTemplate = _.template($('#supTmpl').html());
                    var containerTemplate = _.template($('#referenceTmpl').html());
                    results.forEach(function(val, index) {
                        $(val[1]).after(elementTemplate({i: index}));
                    });

                    var ibids = reference.getIbids(results.map(function(val) {
                        return reference.lookup(reference.text(val[1]));
                    }));

                    var refs = results.map(function(val, index) {
                        return {
                            val: val[0],
                            ibid: ibids[index],
                            page: reference.pageNumber(reference.text(val[1])),
                            isWebsite: reference.iseUrl(val[1]),
                            isPeriodical: reference.isePeriodical(val[1])
                        };
                    });

                    if (results.length > 0) {
                        container.html(containerTemplate({ references: refs }));
                    }

                    grunt.log.writeln(filepath);
                    fs.writeFile(filepath, $.html(), cb);
                }
            ], function(err, result) {
                callback(err);
            });
        }, function(err) {
            if (err) {
                grunt.fail.fatal(err);
            }
            done();            
        });
    });
};
