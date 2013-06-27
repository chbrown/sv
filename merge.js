#!/usr/bin/env node
'use strict'; /*jslint node: true, es5: true, indent: 2 */ /*globals setImmediate */
var os = require('os');
var fs = require('fs');
var util = require('util');
var async = require('async');
var sv = require('./index');
var inference = require('./inference');

function File(path) {
  this.path = path;
  this.columns = undefined;
  this.number_of_lines = undefined;
}
File.prototype.getLines = function(callback) {
  // always async, but sometimes setImmediate. callback signature: function(err, number_of_lines)
  var self = this;
  if (this.number_of_lines !== undefined) {
    setImmediate(callback, this.number_of_lines);
  }
  else {
    inference.lc(this.path, function(err, number_of_lines) {
      self.number_of_lines = number_of_lines;
      callback(err, number_of_lines);
    });
  }
};
File.prototype.readStream = function() {
  return fs.createReadStream(this.path);
};

var merge = module.exports = function(filepaths, verbose) {
  // first pass: collect all possible fieldnames, and linecounts, while we're at it.
  async.map(filepaths, function(filepath, callback) {
    var file = new File(filepath);
    var parser = file.readStream().pipe(new sv.Parser({encoding: 'utf8'}));
    var collect = function() {
      // we don't want to respond to both 'end' and 'data' calls
      parser.removeAllListeners('data').removeAllListeners('end');
      // pausing does no harm if it's already ended
      parser.pause();
      file.columns = parser.columns;
      file.getLines(function(err, number_of_lines) {
        if (err) console.error('wc -l ' + file.path + ' failed: ' + err.toString());
        callback(err, file);
      });
    };
    parser.on('error', callback).on('data', collect).on('end', collect);
  }, function(err, files) {
    if (err) throw err;

    // uniquify all columns, starting with special field for original filename
    var columns = ['pkid', 'original_file'];
    files.forEach(function(file) {
      file.columns.forEach(function(column) {
        if (columns.indexOf(column) == -1) {
          columns.push(column);
        }
      });
    });

    // sum all lines (they've already all be counted, so we can just reach in to the cached value)
    var total_in = files.map(function(file) {
      return file.number_of_lines;
    }).reduce(function(a, b) { return a + b; });

    console.error('Found ' + total_in + ' lines covering ' + columns.length + ' columns in ' + files.length + ' files.');
    if (verbose) {
      console.error(columns.map(function(column) { return '  ' + column + ' (' + column.length + ')'; }).join('\n'));
    }

    // output to STDOUT
    // var out = fs.createWriteStream(filepath, {encoding: 'utf8'});
    var stringifier = new sv.Stringifier({columns: columns})
    .on('error', function(err) {
      console.error('Stringifier error.');
      throw err;
    });

    var out = stringifier.pipe(process.stdout)
    .on('error', function(err) {
      // somebody called | head or something, so we just exit silently.
      process.exit(0);
    });

    var pkid = 1;
    var prefix = inference.commonPrefix(files.map(function(file) { return file.path; }));
    console.error('Removing common prefix from filenames: ' + prefix);
    async.eachSeries(files, function(file, callback) {
      var parser = new sv.Parser({encoding: 'utf8'});
      var original_file = file.path.slice(prefix.length);
      var file_out = 0;

      file.readStream().pipe(parser)
      .on('data', function(row) {
        // first row appearing means that parser.columns is now set.
        row.pkid = pkid++;
        row.original_file = original_file;
        file_out++;
        var write_result = stringifier.write(row);
        if (!write_result) console.error(file.path + ' write_result ' + write_result);
      })
      .on('end', function() {
        setTimeout(function() {
          console.error(original_file + ' (wrote ' + file_out + ' rows, out of ' + file.number_of_lines + ' lines)');
          callback();
        }, 1000);
      });
    }, function(err) {
      console.error('Done. Wrote a total of ' + pkid + ' rows.');
    });
  });
};

if (require.main === module) {
  var argv = require('optimist')
    .usage([
      'Merge several csv files into a single (sparse) csv file.',
      '',
      'Usage: merge.js ~/Desktop/**/*.csv > ~/all.csv',
    ].join('\n')).boolean('verbose').alias('v', 'verbose').argv;
  merge(argv._, argv.verbose);
}
