'use strict'; /*jslint node: true, es5: true, indent: 2 */
var os = require('os');
var stream = require('stream');
var streaming = require('streaming');
var util = require('util');

var inference = require('./inference');
var Parser = exports.Parser = require('./parser');
var Stringifier = exports.Stringifier = require('./stringifier');

function pluck(xs, prop) {
  return xs.map(function(x) { return x[prop]; });
}

var whitespace_literals = {
  '\r': '\\r',
  '\n': '\\n',
  '\t': '\\t',
};
function escapeWhitespace(s) {
  return whitespace_literals[s];
}

var describe = exports.describe = function(input, filename, parser_opts, stringifier_opts, callback) {
  if (filename) {
    console.log(filename);
  }

  var rows = [];
  var parser = input.pipe(new Parser(parser_opts));
  parser.on('data', function(row) {
    rows.push(row);
    if (rows.length > 10) {
      parser.pause();
      for (var i = 0, l = parser.columns.length; i < l; i++) {
        var name = parser.columns[i];
        console.log('[' + i + '] ' + name + ':');

        var cells = pluck(rows, name).join(', ').replace(/\r|\n|\t/g, escapeWhitespace);

        var segment = stringifier_opts.width - 2;
        for (var start = 0, end = cells.length; start < end; start += segment) {
          console.log('  ' + cells.slice(start, start + segment));
        }
      }
      callback();
    }
  });
};

var transform = exports.transform = function(input, filename, parser_opts, stringifier_opts, callback) {
  if (filename) {
    console.error('Transforming ' + filename);
  }

  var parser = input.pipe(new Parser(parser_opts));

  if (stringifier_opts.omit) {
    parser = parser.pipe(new streaming.property.Omitter(stringifier_opts.omit.split(/,/g)));
  }

  if (stringifier_opts.filter) {
    parser = parser.pipe(new streaming.property.Filter(stringifier_opts.filter.split(/,/g)));
  }

  var stringifier = stringifier_opts.json ? new streaming.json.Stringifier() : new Stringifier(stringifier_opts);
  parser.pipe(stringifier);

  var output = stringifier.pipe(process.stdout);

  output.on('finish', callback);
  output.on('error', function(err) {
    // panic! (lets us quit faster, actually)
    input.unpipe();
    output.unpipe();

    callback(err);
  });
};
