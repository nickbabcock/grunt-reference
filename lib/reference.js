'use strict';

var _ = require('underscore');

// Returns all the elements in the DOM that are citable
var getCitableElements = function(window) {
    return _.map(window.$('cite, [cite]'), function(val) {
        return window.$(val);
    });
};

// Returns the text associated with the DOM element
var text = function(ele) {
    return (ele.is('cite') ? ele.text() : ele.attr('cite')).trim()
};

// Returns the most significant part of the string for extracting citations.
var lookup = function(str) {
    return str.split(' ')[0];
};

// Determines if a given string is a url
var isUrl = function(url) {
    return /^https?:/.exec(url);
};

// Determines if a given string is a periodical
var isPeriodical = function(str) {
    return str.indexOf('/') !== -1 && !isUrl(str);
};

// Determines if a given string is a ISBN number
var isISBN = function(str) {
    return /^\d{9,10}|\d{13}$/.exec(lookup(str));
};

// An ibid occurs whenever the citation immediately prior has the same value
var getIbids = function(arr) {
    return _.map(arr, function(val, index, list) {
        return index !== 0 && val === list[index - 1];
    });
};

var parseGoogle = function(json) {
    var result = json.items[0].volumeInfo;
    result.publishedDate = new Date(Date.parse(result.publishedDate));
    return json.items[0].volumeInfo;
};

var parsePeriodical = function(json) {
    json.publishedDate = new Date(json.published_on * 1000);
    return json;
};

// Determines if a given DOM element is a periodical
var isePeriodical = function(ele) {
    return isPeriodical(lookup(text(ele)));    
};

// Determines if a given DOM element is a ISBN number
var iseISBN = function(ele) {
    return isISBN(lookup(text(ele)));
};

// Determines if a given DOM element is a Url
var iseUrl = function(ele) {
    return isUrl(lookup(text(ele)));
};

var pageNumber = function(str) {
    var arr = str.split(' ');
    return parseInt(arr[1], 10) || 0;
};

module.exports = {
    getCitableElements: getCitableElements,
    isUrl: isUrl,
    isPeriodical: isPeriodical,
    isISBN: isISBN,
    getIbids: getIbids,
    text: text,
    lookup: lookup,
    iseUrl: iseUrl,
    isePeriodical: isePeriodical,
    iseISBN: iseISBN,
    pageNumber: pageNumber,
    parseGoogle: parseGoogle,
    parsePeriodical: parsePeriodical
};
