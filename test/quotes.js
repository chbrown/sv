'use strict'; /*jslint node: true, es5: true, indent: 2 */
var fs = require('fs');
var test = require('tap').test;

var sv = require('..');

test('excel dialect parser', function (t) {
  var input = [
    'index\tname\ttime',
    '1\t"chris ""breezy"" brown"\t1:20',
    '2\tstephen\t"1:21"""',
    '3\tlordy\t"1:22""x"',
  ].join('\n');

  var rows = [];
  var parser = new sv.Parser();
  parser.on('data', function(obj) {
    rows.push(obj);
  });
  parser.end(input, function() {
    t.equal(rows.length, 3, 'There should be three rows.');
    t.equal(rows[0].name, 'chris "breezy" brown', 'The paired double quotes should be interpreted as just one double quote.');
    t.equal(rows[1].time, '1:21"', 'Lone triple quotes signify an escaped quote and then end of field.');
    t.equal(rows[2].time, '1:22"x', 'Paired double quotes should collapse to just one.');
    t.end();
  });
});

test('quoted newlines', function (t) {
  var input = [
    'index  name  time',
    '1  "chris\ngrant\nbrown" 1:49',
    '2  "stephen\nhodgins" 1:50',
  ].join('\n');

  var rows = [];
  var parser = new sv.Parser();
  parser.on('data', function(obj) {
    rows.push(obj);
  });
  parser.end(input, function() {
    // t.equal(found, wanted, ...)
    t.equal(rows.length, 2, 'There should be exactly two rows.');
    t.equal(rows[0].name, 'chris\ngrant\nbrown', 'Newlines should be retained.');
    t.end();
  });
});
