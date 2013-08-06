module.exports = function(grunt) {
    'use strict';

    var jsdom = require('jsdom');
    var path = require('path');
    var fs = require('fs');
    var request = require('request');
    var async = require('async');
    var pluginName = 'referencejs';
    var cachedRequests = path.resolve('./.grunt/' + pluginName + '/cachedRequests.js');

    var scripts = [
        '//ajax.googleapis.com/ajax/libs/jquery/1.10.0/jquery.min.js',
        '//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.5.1/underscore-min.js',
        '//cdnjs.cloudflare.com/ajax/libs/d3/3.2.2/d3.v3.min.js'
    ];

    var documentToSource = function(document) {
        return document.doctype.toString() + document.innerHTML;
    };

    var parseRequired = function(task, arr) {
        var options = {};
        arr.forEach(function(val) {
            if (task.data[val] === undefined) {
                grunt.fail.fatal('Must provide ' + val + ' option');
            }
            else {
                options[val] = task.data[val];
            }
        });

        return options;
    };

    grunt.registerMultiTask('renderReferencePage', function() {
        var done = this.async();

        var requiredConfig = ['templateId', 'containerSelector'];
        var options = parseRequired(this, requiredConfig);

        this.filesSrc.forEach(function(val) {
            jsdom.env(val, scripts, function(errors, window) {
                var $ = window.$;
                var _ = window._;

                var contents = fs.readFileSync(cachedRequests);
                contents = JSON.parse(contents);

                // Extracts all the books from all the posts and groups them by
                // their id.  Then creates an object that simplifies properties.
                // Orders the array such that most cited books are first.
                contents = _.chain(contents)
                .pluck('data')
                .flatten()
                .filter(function(val) { return !val.periodical && !val.website; })
                .groupBy(function(val) { return val.requestResult.id; })
                .map(function(val) {
                    return {
                        count: val.length,
                        title: val[0].requestResult.volumeInfo.title,
                        authors: val[0].requestResult.volumeInfo.authors,
                        description: val[0].requestResult.volumeInfo.description,
                        publishedDate: val[0].requestResult.volumeInfo.publishedDate,
                        publisher: val[0].requestResult.volumeInfo.publisher,
                        image: val[0].requestResult.volumeInfo.imageLinks.thumbnail
                    };
                })
                .sortBy(function(val) { return val.count; })
                .value()
                .reverse();

                var templ = _.template($('#' + options.templateId).html());

                $(options.containerSelector).append($('<div>').html(templ({ references: contents })));

                // jsdom appends script elements that are passed into it with a
                // script tag of jsdom class. Remove these.
                $('script.jsdom').remove();

                fs.writeFileSync(val, documentToSource(window.document));
                done();
            });
        });
    });

    grunt.registerMultiTask('reference', function() {
        var task = this;
        var done = this.async();
        var files = this.filesSrc;

        // Finds all the citable elements from a given DOM and maps them to an
        // intermediate object that houses information about how further
        // information should be retrieved.  Returns these intermediate
        // objects.
        var getCitableReferences = function(window) {
            var $ = window.$;
            var _ = window._;

            var referenceElements = $('[cite], cite');

            return _.map(referenceElements, function(val, ind, arr) {
                var citation = $.trim(val.getAttribute('cite') || $(val).text());

                var split = citation.split(' ');
                var lookup = split[0];
                var pageReference = split[1];

                return {
                    element: val,
                    elementIndex: ind,
                    page: parseInt(pageReference, 10) || 0,
                    periodical: lookup.indexOf('/') !== -1 && lookup.indexOf('http') === -1,
                    website: lookup.indexOf('http') !== -1,
                    lookup: lookup
                };
            });
        };

        // ayncronously requests data for a citation.  Depending on how the
        // citation is formatted, the requests will be sent to a different
        // source.
        var processDOM = function(window, options, callback) {
            var $ = window.$;
            var _ = window._;
            var requests = getCitableReferences(window);

            async.each(requests, function(newCitation, lookupComplete) {
                var lookup = newCitation.lookup;
                if (newCitation.website) {
                    newCitation.requestResult = { id: lookup, authors: [] };
                    lookupComplete();
                }
                else if (newCitation.periodical) {
                    var urlP = 'http://api.altmetric.com/v1/doi/' + lookup;
                    request.get(urlP, function(error, response, body) {
                        body = JSON.parse(body);
                        newCitation.requestResult = body;
                        newCitation.requestResult.publishedDate = new Date(body.published_on * 1000);
                        newCitation.requestResult.id = newCitation.requestResult.doi;
                        newCitation.requestResult.authors = [];
                        lookupComplete();
                    });
                }
                else {
                    var urlG = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + lookup;
                    request.get(urlG, function(error, response, body) {
                        body = JSON.parse(body);
                        newCitation.requestResult = body.items[0];
                        newCitation.requestResult.volumeInfo.publishedDate = new Date(Date.parse(newCitation.requestResult.volumeInfo.publishedDate));
                        lookupComplete();
                    });
                }
            }, function(err) {
                callback(window, requests, options);
            });
        };

        // Finds any equivalencies between the found data
        var mapIbids = function(arr) {

            // An ibid occurs whenever the citation immediately prior has the
            // same id.
            for (var i = 1; i < arr.length; i++) {
                arr[i].ibid = arr[i].requestResult.id === arr[i-1].requestResult.id;
            }
        };

        // Modify the DOM with the found data and overwrite the old file
        var domRequestsCompleted = function(window, data, options) {
            var $ = window.$;
            var _ = window._;

            mapIbids(data);

            var container = $('#' + options.referenceContainerId);
            var elementTemplate = _.template($('#' + options.elementTemplateId).html());
            var containerTemplate = _.template($('#' + options.referenceTemplateId).html());

            // Render the template which is inserted after each citation element
            data.forEach(function(val, ind) {
                $(val.element).after(elementTemplate({ i: ind }));
            });

            // Render the template which holds all of the page's references
            container.html(containerTemplate({ references: data }));

            // jsdom appends script elements that are passed into it with a
            // script tag of jsdom class. Remove these.
            $('script.jsdom').remove();

            fs.writeFileSync(window.location.pathname, documentToSource(window.document));
        };

        var requiredConfig = ['referenceContainerId', 'elementTemplateId', 'referenceTemplateId'];
        var options = parseRequired(task, requiredConfig);

        // If we've already aggregated the data into a file, we should re-use
        // that data instead issuing additional requests.  This also avoids
        // the problem that google throttles usage above a certain threshold
        if (fs.existsSync(cachedRequests)) {
            var contents = fs.readFileSync(cachedRequests);
            contents = JSON.parse(contents);            
        }

        var fileJSON = [];
        async.each(files, function(f, callback) {
            jsdom.env(path.resolve(f), scripts, function(errors, window) {

                // If we have already calculated the citations for this file
                // use them instead of sending new requests.
                if (!errors && contents) {
                    var _ = window._;

                    // Have to re-figure out citable elements because they
                    // could not be saved due to their cyclical nature
                    var requests = getCitableReferences(window);
                    var doc = _.find(contents, function(val) {
                        return val.path === window.location.pathname; 
                    });

                    // If the page had citations...
                    if (doc !== undefined) {
                        doc.data.forEach(function(val, ind) {
                            val.elementIndex = ind;
                            val.element = requests[ind].element;

                            // JSON dates are a pain to extract
                            if (val.requestResult.publishedDate !== undefined) {
                                val.requestResult.publishedDate = 
                                    new Date(Date.parse(val.requestResult.publishedDate));
                            }
                            else if (!val.website && !val.periodical && 
                                val.requestResult.volumeInfo.publishedDate !== undefined) {
                                val.requestResult.volumeInfo.publishedDate = 
                                    new Date(Date.parse(val.requestResult.volumeInfo.publishedDate));
                            }
                        });

                        domRequestsCompleted(window, doc.data, options);                       
                    }
                    callback();
                }   
                else if (!errors) {
                    processDOM(window, options, function(window, data, options) {

                        // If citable elements were found in the page...
                        if (data.length !== 0) {
                            domRequestsCompleted(window, data, options);

                            // Delete element because of its cyclical nature.
                            // JSON can't encode DOM elements
                            data.forEach(function(val, ind) {
                                delete val.element;
                                delete val.elementIndex;
                            });

                            var newFile = {
                                title: window.document.title,
                                path: window.location.pathname,
                                data: data
                            };

                            fileJSON.push(newFile);
                        }
                        callback();
                    });                 
                }       
                else {
                    grunt.log.writeln('error');
                    callback();
                }   
            });
        }, function(error) {
            if (!contents) {
                fs.writeFileSync(cachedRequests, JSON.stringify(fileJSON, null, '\t'));
            }
            done();
        });
    });
};
