'use strict'; /*jslint node: true, es5: true, indent: 2 */
var async = require('async');
var fs = require('fs');
var path = require('path');
var tap = require('tap');
var streaming = require('streaming');

var sv = require('..');

tap.test('pairs', function(t) {
  // it's the goddamn tests, we can use sync
  var files = fs.readdirSync('pairs');
  var basenames = {};
  files.forEach(function(file) {
    var basename = path.basename(file, path.extname(file));
    if (basenames[basename] === undefined) basenames[basename] = [];
    basenames[basename].push(file);
  });

  async.each(Object.keys(basenames), function(basename, callback) {
    var group = basenames[basename];
    var json_filename = basename + '.json';
    console.error('JSON>>', json_filename, group);
    if (group.indexOf(json_filename) > -1) {
      var json = fs.readFileSync('pairs/' + json_filename, {encoding: 'utf8'});
      var gold = JSON.parse(json);

      var other_filenames = group.filter(function(filename) {
        return filename != json_filename;
      });

      async.each(other_filenames, function(other_filename, callback) {
        var stream = fs.createReadStream('pairs/' + other_filename);
        streaming.readToEnd(stream.pipe(new sv.Parser()), function(err, rows) {
          t.equivalent(rows, gold);
          callback(err);
        });
      }, callback);
    }
    else {
      callback();
    }
  }, function(err) {
    t.notOk(err, 'all pairs should be compared without error');
    t.end();
  });
});

