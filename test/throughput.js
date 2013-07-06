'use strict'; /*jslint node: true, es5: true, indent: 2, multistr: true */
var fs = require('fs');
var test = require('tap').test;

var sv = require('..');

test('throughput test', function (t) {
  var input = [
    { index: '1', name: 'chris', time: '1:29' },
    { index: '2', name: 'daniel', time: '1:17' },
    { index: '3', name: 'lewis', time: '1:30' },
    { index: '4', name: 'stephen', time: '1:16' },
    { index: '5', name: 'larry', time: '1:31' },
  ];

  var output = [];
  var stringifier = new sv.Stringifier({peek: 2, missing: 'NA'});

  var parser = new sv.Parser({encoding: stringifier.encoding, quotechar: '"'});
  parser.on('data', function(obj) {
    output.push(obj);
  });
  parser.on('end', function() {
    t.similar(output, input, 'Throughput should be transparent.');
    t.end();
  });

  stringifier.pipe(parser);
  input.forEach(function(record) {
    stringifier.write(record);
  });
  stringifier.end();
});

// var input = fs.createReadStream('test/peektest.in', {encoding: 'utf8'});
// var async = require('async');
// async.map(['peektest.in', 'peektest.out'], fs.readFile, function(err, files) {
