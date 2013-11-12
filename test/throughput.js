'use strict'; /*jslint node: true, es5: true, indent: 2 */
var fs = require('fs');
var tap = require('tap');
var streaming = require('streaming');
var sv = require('..');

tap.test('passthrough', function(t) {
  var input = [
    { index: '1', name: 'chris', time: '1:29' },
    { index: '2', name: 'daniel', time: '1:17' },
    { index: '3', name: 'lewis', time: '1:30' },
    { index: '4', name: 'stephen', time: '1:16' },
    { index: '5', name: 'larry', time: '1:31' },
  ];

  var stringifier = new sv.Stringifier({peek: 2, missing: 'NA'});

  var parser = stringifier.pipe(new sv.Parser());
  streaming.readToEnd(parser, function(err, output) {
    t.equivalent(output, input, 'Throughput should be transparent.');
    t.end();
  });

  input.forEach(function(record) {
    stringifier.write(record);
  });
  stringifier.end();
});

tap.test('filter', function(t) {
  var parser = new sv.Parser();
  var filter = new streaming.property.Filter(['index', 'name']);
  parser.pipe(filter);

  parser.end([
    'index,name,time',
    '1,chris,NA',
    '2,daniel,1:17',
    '3,lewis,1:30',
    '4,stephen,1:16',
    '5,larry,1:31',
  ].join('\n'));

  streaming.readToEnd(filter, function(err, output) {
    t.equal(output[2].name, 'lewis', 'Third row should have name of "lewis"');
    t.notOk(output[1].time, 'No row should have a "time" field.');
    t.ok(output[0].index, 'First row should have an "index" field.');
    t.end();
  });
});


tap.test('omitter', function(t) {
  var parser = new sv.Parser();
  var omitter = new streaming.property.Omitter(['index', 'name']);
  parser.pipe(omitter);

  parser.end([
    'index,name,time',
    '1,chris,NA',
    '2,daniel,1:17',
    '3,lewis,1:30',
    '4,stephen,1:16',
    '5,larry,1:31',
  ].join('\n'));

  streaming.readToEnd(omitter, function(err, output) {
    t.equal(output[2].time, '1:30', 'Third row should have time of "1:30"');
    t.notOk(output[1].index, 'No row should have an "index" field.');
    t.ok(output[0].time, 'First row should have a "time" field.');
    t.end();
  });
});

// var input = fs.createReadStream('test/peektest.in', {encoding: 'utf8'});
// var async = require('async');
// async.map(['peektest.in', 'peektest.out'], fs.readFile, function(err, files) {
