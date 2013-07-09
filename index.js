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
  this._fields = fields;
  this._fields_length = fields.length;
};
util.inherits(ObjectFilter, stream.Transform);
ObjectFilter.prototype._transform = function(chunk, encoding, callback) {
  var filtered = {};
  for (var i = 0; i < this._fields_length; i++) {
    filtered[this._fields[i]] = chunk[this._fields[i]];
  }
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

  for (var field in this.fields) {
    delete chunk[field];
  }
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

function describe(input, filename, parser_opts, stringifier_opts, callback) {
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
}

function read(input, filename, parser_opts, stringifier_opts, callback) {
  if (filename) {
    console.error('Reading ' + filename);
  }

  var parser = input.pipe(new Parser(parser_opts));

  if (stringifier_opts.omit) {
    parser = parser.pipe(new ObjectOmitter(stringifier_opts.omit.split(/,/g)));
  }

  if (stringifier_opts.filter) {
    parser = parser.pipe(new ObjectFilter(stringifier_opts.filter.split(/,/g)));
  }

  var stringifier = stringifier_opts.json ? new JSONStringifier() : new Stringifier(stringifier_opts);
  parser.pipe(stringifier);

  var output = stringifier.pipe(process.stdout);

  output.on('finish', callback);
  output.on('error', function(err) {
    // panic! (let's us quit faster, actually)
    input.unpipe();
    output.unpipe();

    callback(err);
  });
}

if (require.main === module) {
  var optimist = require('optimist')
    .usage([
      'Consolidate any tabular format.',
      '',
      'Usage: <sprints.txt sv [options] > sprints.csv',
      '   or: sv [options] ~/Desktop/**/*.csv > ~/all.csv',
      '',
      'Parser options:',
      '  --peek 10         infer columns from first ten lines of input',
      '  --in-delimiter    field separator (inferred if unspecified)',
      '  --in-quotechar "  ',
      // '  --escapechar \\  escape quotechars when quoted',
      '',
      'Stringifier options:',
      '  --out-delimiter , field separator',
      '  --out-quotechar " marks beginning and end of fields containing delimiter',
      '      --filter a,b  keep only fields a and b in the results',
      '      --omit c,d    leave out fields x and y from the results',
      '                    omit is processed before filter',
      '  -j, --json        write one JSON object per row',
      '',
      'Other options:',
      '      --describe      only describe the data, using headers and a few examples',
      '      --width         width of the terminal (used by --describe)',
      '      --merge         merge multiple files supplied as command line args',
      '      --version       print version and quit',
      '  -v  --verbose       turn up the verbosity (still all on STDERR)',
      '',
      'STDIN, if supplied, will be coerced to utf8',
    ].join('\n'))
    .string(['delimiter', 'quotechar', 'escapechar'])
    .boolean(['json', 'describe', 'merge', 'verbose', 'version'])
    .alias({
      j: 'json',
      v: 'verbose',
    })
    .default({
      width: process.stdout.columns || 80,
    });
  var argv = optimist.argv;
  var parser_opts = {
    peek: argv.peek,
    delimiter: argv['in-delimiter'],
    quotechar: argv['in-quotechar'],
  };
  var stringifier_opts = {
    delimiter: argv['out-delimiter'],
    quotechar: argv['out-quotechar'],
    filter: argv.filter,
    omit: argv.omit,
    json: argv.json,
    width: argv.width,
  };

  // func: function (stream, filename, parser_opts, stringifier_opts, callback) { ... }
  var func = argv.describe ? describe : read;
  var exit = function(err) {
    if (err && err.code != 'EPIPE') {
      throw err;
    }
    // if err.code == 'EPIPE' that just means that someone down
    // the line cut us short with a | head or something

    if (argv.verbose) {
      console.error('Done.');
    }
    // process.exit(); // wait for stdout to finish, actually.
  };

  if (argv.help) {
    optimist.showHelp();
    console.log('ARGV: ' + process.argv.join(' '));
    if (argv.verbose) {
      console.log('  argv: ' + JSON.stringify(argv, null, '  ').replace(/\n/g, '\n  '));
    }
    console.log('  parser options: ' + JSON.stringify(parser_opts, null, '  ').replace(/\n/g, '\n  '));
    console.log('  stringifier options: ' + JSON.stringify(stringifier_opts, null, '  ').replace(/\n/g, '\n  '));
  }
  else if (argv.version) {
    fs.readFile(__dirname + '/package.json', function (err, package_string) {
      if (err) throw err;
      var package_json = JSON.parse(package_string);
      console.log('v' + package_json.version);
    });
  }
  else if (!process.stdin.isTTY) {
    // process.stdin.setEncoding('utf8');
    func(process.stdin, null, parser_opts, stringifier_opts, exit);
  }
  else if (argv._.length) {
    if (argv.merge) {
      console.error('Merging.');
      merge(argv._, argv, exit);
    }
    else {
      async.eachSeries(argv._, function(filepath, callback) {
        var stream = fs.createReadStream(filepath);
        func(stream, filepath, parser_opts, stringifier_opts, callback);
        console.error(''); // newline
      }, exit);
    }
  }
  else {
    optimist.showHelp();
    console.error('You must supply data via STDIN or as unflagged command line arguments.');
  }
}
