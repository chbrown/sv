#!/usr/bin/env node
'use strict'; /*jslint node: true, es5: true, indent: 2 */

var os = require('os');
var util = require('util');
var stream = require('stream');
var Parser = exports.Parser = require('./parser');
var Stringifier = exports.Stringifier = require('./stringifier');

// function logEvents(emitter, prefix, names) {
//   names.forEach(function(name) {
//     emitter.on(name, function(/*...*/) {
//       console.error(prefix + ':' + name, arguments);
//     });
//   });
// }

var JSONStringifier = function(opts) {
  stream.Transform.call(this, {objectMode: true});
  this._readableState.objectMode = false;
};
util.inherits(JSONStringifier, stream.Transform);
JSONStringifier.prototype._transform = function(chunk, encoding, callback) {
  this.push(JSON.stringify(chunk) + os.EOL, encoding);
  callback();
};

var ObjectFilter = function(fields) {
  // objects in, objects out
  stream.Transform.call(this, {objectMode: true});
  this.fields = {};
  for (var i = 0, l = fields.length; i < l; i++) {
    this.fields[fields[i]] = 1;
  }
};
util.inherits(ObjectFilter, stream.Transform);
ObjectFilter.prototype._transform = function(chunk, encoding, callback) {
  var filtered = {};
  for (var field in this.fields)
    filtered[field] = chunk[field];
  this.push(filtered, encoding);
  callback();
};

var ObjectOmitter = function(fields) {
  // objects in, objects out
  stream.Transform.call(this, {objectMode: true});
  this.fields = {};
  for (var i = 0, l = fields.length; i < l; i++) {
    this.fields[fields[i]] = 1;
  }
};
util.inherits(ObjectOmitter, stream.Transform);
ObjectOmitter.prototype._transform = function(chunk, encoding, callback) {
  for (var field in this.fields)
    delete chunk[field];
  this.push(chunk, encoding);
  callback();
};


if (require.main === module) {
  var optimist = require('optimist')
    .usage([
      'Consolidate any tabular format.',
      '',
      'Usage: <sprints.txt sv [options] > sprints.csv',
      '',
      'Options:',
      '  -p, --peek 10       infer columns from first ten lines of input',
      '  -d, --delimiter ,   field separator',
      '  -q, --quotechar "   mark beginning and end of fields containing delimiter',
      '  -e, --escapechar \\  escape quotechars when quoted',
      '  -j, --json          write one JSON object per row',
      '      --filter a,b    keep only fields a and b in the results',
      '      --omit c,d      leave out fields x and y from the results',
      '                      (do not use filter and omit together)',
      '',
      'Only STDIN is supported, and it is coerced to utf8',
    ].join('\n'))
    .string('delimiter')
    .boolean(['json',])
    .alias({
      p: 'peek',
      d: 'delimiter',
      q: 'quotechar',
      e: 'escapechar',
      j: 'json',
    });
  var argv = optimist.argv;

  if (argv.help) {
    optimist.showHelp();
    console.log('ARGV: ' + process.argv.join(' '));
  }
  else if (process.stdin.isTTY) {
    optimist.showHelp();
    console.error('You must supply data via STDIN');
  }
  else {
    var stringifier = argv.json ? new JSONStringifier() : new Stringifier(argv);

    process.stdin.setEncoding('utf8');
    var parser = process.stdin.pipe(new Parser());
    var filtered = null;
    if (argv.filter) {
      filtered = parser.pipe(new ObjectFilter(argv.filter.split(/,/g)));
    }
    else if (argv.omit) {
      filtered = parser.pipe(new ObjectOmitter(argv.omit.split(/,/g)));
    }
    else {
      filtered = parser;
    }
    filtered.pipe(stringifier).pipe(process.stdout);
  }
}
