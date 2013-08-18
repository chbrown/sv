#!/usr/bin/env node
'use strict'; /*jslint node: true, es5: true, indent: 2 */
var fs = require('fs');
var async = require('async');
var sv = require('..');
var merge = require('../merge');

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
      '  --filter a,b      keep only fields a and b in the results',
      '  --omit c,d        leave out fields x and y from the results (processed before filter)',
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
  var func = argv.describe ? sv.describe : sv.transform;
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
    console.log(require('../package').version);
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
