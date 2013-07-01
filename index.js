#!/usr/bin/env node
'use strict'; /*jslint node: true, es5: true, indent: 2 */
var async = require('async');
var fs = require('fs');
var os = require('os');
var stream = require('stream');
var util = require('util');

var inference = require('./inference');
var merge = require('./merge');
var Parser = exports.Parser = require('./parser');
var Stringifier = exports.Stringifier = require('./stringifier');

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

function describe(stream, filename, opts, callback) {
  if (filename) {
    console.log(filename);
  }

  var rows = [];

  var parser = stream.pipe(new Parser());
  var onData = function(row) {
    rows.push(row);
    if (rows.length > 10) {
      parser.removeListener('data', onData);
      // parser.columns are ordered like the original, inference.columns may not be
      var columns = parser.columns || inference.columns(rows);
      for (var i = 0, l = parser.columns.length; i < l; i++) {
        var name = parser.columns[i];
        console.log('[' + i + '] ' + name + ':');

        var cells = pluck(rows, name).join(', ').replace(/\r|\n|\t/g, escapeWhitespace);

        var segment = opts.width - 2;
        for (var start = 0, end = cells.length; start < end; start += segment) {
          console.log('  ' + cells.slice(start, start + segment));
        }
      }
      callback();
    }
  };
  parser.on('data', onData);
}

function read(stream, filename, opts, callback) {
  if (filename) {
    console.error('Reading ' + filename);
  }

  stream = stream.pipe(new Parser());

  if (opts.omit) {
    stream = stream.pipe(new ObjectOmitter(opts.omit.split(/,/g)));
  }

  if (opts.filter) {
    stream = stream.pipe(new ObjectFilter(opts.filter.split(/,/g)));
  }

  var stringifier = opts.json ? new JSONStringifier() : new Stringifier(opts);
  stream = stream.pipe(stringifier);
  stream = stream.pipe(process.stdout);

  stream.on('finish', callback);
  stream.on('error', callback.bind(null));
}

if (require.main === module) {
  var optimist = require('optimist')
    .usage([
      'Consolidate any tabular format.',
      '',
      'Usage: <sprints.txt sv [options] > sprints.csv',
      '   or: sv [options] ~/Desktop/**/*.csv > ~/all.csv',
      '',
      'Options:',
      '  -p, --peek 10       infer columns from first ten lines of input',
      '  -d, --delimiter ,   field separator',
      '  -q, --quotechar "   mark beginning and end of fields containing delimiter',
      '  -e, --escapechar \\  escape quotechars when quoted',
      '  -j, --json          write one JSON object per row',
      '      --filter a,b    keep only fields a and b in the results',
      '      --omit c,d      leave out fields x and y from the results',
      '                      do not use filter and omit together',
      '      --describe      only describe the data, using headers and a few examples',
      '      --width         width of the terminal (used by --describe)',
      '      --merge         merge multiple files supplied as command line args',
      '  -v  --verbose       turn up the verbosity (still all on STDERR)',
      '',
      'STDIN, if supplied, will be coerced to utf8',
    ].join('\n'))
    .string(['delimiter', 'quotechar', 'escapechar'])
    .boolean(['json', 'describe', 'merge', 'verbose'])
    .alias({
      p: 'peek',
      d: 'delimiter',
      q: 'quotechar',
      e: 'escapechar',
      j: 'json',
      v: 'verbose',
    })
    .default({
      width: process.stdout.columns || 80,
    });
  var argv = optimist.argv;

  var func = argv.describe ? describe : read; // function (stream, filename, opts, callback) { ... }

  if (argv.help) {
    optimist.showHelp();
    console.log('ARGV: ' + process.argv.join(' '));
  }
  else if (!process.stdin.isTTY) {
    // process.stdin.setEncoding('utf8');
    func(process.stdin, null, argv, function(err) {
      if (err) throw err;
      console.error('Done.');
    });
  }
  else if (argv._.length) {
    if (argv.merge) {
      console.error('Merging.');
      merge(argv._, argv, function(err) {
        if (err) throw err;
        console.error('Done.');
      });
    }
    else {
      async.eachSeries(argv._, function(filepath, callback) {
        var stream = fs.createReadStream(filepath);
        func(stream, filepath, argv, callback);
        console.error(''); // newline
      }, function(err) {
        if (err) throw err;
        console.error('Done.');
      });
    }
  }
  else {
    optimist.showHelp();
    console.error('You must supply data via STDIN or as unflagged command line arguments.');
  }
}
