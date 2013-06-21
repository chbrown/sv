'use strict'; /*jslint node: true, es5: true, indent: 2 */
var util = require('util');


var columns = exports.columns = function(objects) {
  var columns = [];
  var seen = {};
  for (var obj, i = 0; (obj = objects[i]); i++) {
    // each object might be a string, array, or object, but only objects matter here.
    if (typeof(obj) !== 'string' && !util.isArray(obj)) {
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          // maybe should also check that obj[key] != null
          if (!(key in seen)) {
            columns.push(key);
            seen[key] = 1;
          }
        }
      }
    }
  }
  return columns;
};


var zip = exports.zip = function(keys, values, missing) {
  var obj = {};
  for (var i = 0, l = keys.length; i < l; i++) {
    obj[keys[i]] = values[i] || missing;
  }
  return obj;
};


var delimiter = exports.delimiter = function(buffer) {
  // returns a single char code (a byte) denoting the inferred delimiter

  var counts = {};
  // we look at the first newline or 256 chars, whichever is greater,
  //   but without going through the whole file
  var upto = Math.min(256, buffer.length);
  for (var i = 0; i < upto && buffer[i] != 10 && buffer[i] != 13; i++) {
    var char_code = buffer[i];
    counts[char_code] = (counts[char_code] || 0) + 1;
  }

  // we'll go through, prioritizing characters that aren't likely to show
  // up unless they are a delimiter.
  var candidates = [
    9, // '\t' (tab)
    59, // ';' (semicolon)
    44, // ',' (comma)
    32, // ' ' (space)
  ];
  // TODO: make this more robust (that's why I even counted them)
  for (var candidate, j = 0; (candidate = candidates[j]); j++) {
    if (counts[candidate] > 0)
      return candidate;
  }
};
