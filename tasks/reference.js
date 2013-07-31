module.exports = function(grunt) {
	'use strict';

	var jsdom = require('jsdom');
	var path = require('path');
	var fs = require('fs');
	var request = require('request');

	var scripts = [
		'//ajax.googleapis.com/ajax/libs/jquery/1.10.0/jquery.min.js',
		'//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.5.1/underscore-min.js'
	];

	var documentToSource = function(document) {
		return document.doctype.toString() + document.innerHTML;
	};

	grunt.registerMultiTask('renderReferencePage', function() {
		var done = this.async();

		var filePath = '/mnt/Windows/nbsoftsolutions/_site/blog/reference-track-sheet.html';
		jsdom.env(filePath, scripts, function(errors, window) {

			var $ = window.$;
			var _ = window._;

			var contents = fs.readFileSync(path.resolve('./__citeBuffer.js'));
			contents = JSON.parse(contents);

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

			var templ = _.template($('#referencePageTmpl').html());

			$('div.Product').append($('<div>').html(templ({ references: contents })));
			$('script.jsdom').remove();

			fs.writeFileSync(filePath, documentToSource(window.document));
			done();
		});
	});

	grunt.registerMultiTask('reference', function() {
		var task = this;
		var done = this.async();

		var files = this.filesSrc;


		var processDOM = function(window, options, callback) {
			var filePath = window.location.pathname;
			var $ = window.$;
			var _ = window._;

			var referenceElements = $('[cite], cite');

			var citationsCompleted = 0;
			var requests = [];
			_.each(referenceElements, function(val, ind, arr) {
				var citation = $.trim(val.getAttribute('cite') || $(val).text());

				var split = citation.split(' ');
				var lookup = split[0];
				var pageReference = split[1];

				var lookupComplete = function() {
					citationsCompleted++;
					if (citationsCompleted === arr.length) {
						callback(window, requests, options);
					}					
				};

				var newCitation = {
					element: val,
					elementIndex: ind,
					page: parseInt(pageReference, 10) || 0,
				};

				if (lookup.indexOf('http') !== -1) {
					newCitation.requestResult = { id: lookup, authors: [] };
					newCitation.website = true;
					requests.push(newCitation);
					lookupComplete();
				}
				else if (lookup.indexOf('/') !== -1) {
					var urlP = 'http://api.altmetric.com/v1/doi/' + lookup;
					request.get(urlP, function(error, response, body) {
						body = JSON.parse(body);
						newCitation.periodical = true;
						newCitation.requestResult = body;
						newCitation.requestResult.publishedDate = new Date(body.published_on * 1000);
						newCitation.requestResult.id = newCitation.requestResult.doi;
						newCitation.requestResult.authors = [];
						requests.push(newCitation);
						lookupComplete();
					});
				}
				else {
					var urlG = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + lookup;
					request.get(urlG, function(error, response, body) {
						body = JSON.parse(body);
						newCitation.requestResult = body.items[0];
						newCitation.requestResult.volumeInfo.publishedDate = new Date(Date.parse(newCitation.requestResult.volumeInfo.publishedDate));
						requests.push(newCitation);		
						lookupComplete();
					});
				}
			});

			if (referenceElements.length === 0) {
				callback(window, undefined);
			}
		};

		var mapIbids = function(arr) {
			var mapOnId = function(element) {
				return element.requestResult.id;
			};

			for (var i = arr.length - 1; i >= 0; i--) {
				var next = arr.map(mapOnId)
					.lastIndexOf(arr[i].requestResult.id, i - 1);

				if (next <= 0 && arr[0].requestResult.id !== arr[i].requestResult.id) {
					arr[i].ibidDifference = -1;
				}
				else {
					arr[i].ibidDifference = i - next;
				}
			}
		};

		var domRequestsCompleted = function(window, data, options) {
			var $ = window.$;
			var _ = window._;

			grunt.log.writeln("A");
			mapIbids(data);

			var container = $('#' + options.referenceContainer);
			var elementTemplate = _.template($('#' + options.elementTemplateId).html());
			var containerTemplate = _.template($('#' + options.referenceTemplateId).html());

			grunt.log.writeln("B");
			data.forEach(function(val, ind) {
				$(val.element).after(elementTemplate({ i: ind }));
			});

			grunt.log.writeln("C");
			grunt.log.writeln(window.location.pathname);
			container.html(containerTemplate({ references: data }));
			grunt.log.writeln("D");

			$('script.jsdom').remove();

			fs.writeFileSync(window.location.pathname, documentToSource(window.document));
		};


		var filesCompleted = 0;
		var fileJSON = [];
		files.forEach(function(f, ind, arr) {
			var doneAfterAllFilesComplete = function() {
				filesCompleted++;
				if (filesCompleted === arr.length) {
					fs.writeFileSync('./__citeBuffer.js', JSON.stringify(fileJSON, null, '\t'));
					done();
				}
			};

			jsdom.env(path.resolve(f), scripts, function(errors, window) {
				grunt.log.writeln(f);
				if (!errors){
					processDOM(window, task.options(), function(window, data, options) {
						if (data !== undefined) {
							domRequestsCompleted(window, data, options);

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
						doneAfterAllFilesComplete();
					});
				}			
				else {
					grunt.log.writeln('error');
					doneAfterAllFilesComplete();
				}	
			});
		});
	});
};