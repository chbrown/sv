'use strict'; /*jslint node: true, es5: true, indent: 2 */
var fs = require('fs');
var tap = require('tap');

var sv = require('..');

tap.test('import', function (t) {
  t.ok(sv !== undefined, 'sv should load from the current directory');
  t.end();
});

tap.test('parser', function (t) {
  var input = [
    'index	name	time',
    '1	chris	1:18',
    '2	daniel	1:17',
    '3	lewis	1:30',
    '4	stephen	1:16',
    '5	larry	1:31'
  ].join('\n');

  var rows = [];
  var parser = new sv.Parser({quotechar: '"'});
  parser.on('data', function(obj) {
    rows.push(obj);
  });
  parser.end(input, function() {
    t.ok(rows[2], 'There should be a third row');
    t.equal(rows[2].name, 'lewis', 'The name attribute of the third row should be "lewis"');
    t.end();
  });
});

tap.test('stringify', function (t) {
  var expected = [
    'index,name,time',
    '1,chris,NA',
    '2,daniel,1:17',
    '3,lewis,1:30',
    '4,stephen,1:16',
    '5,larry,1:31',
    '' // trailing newline
  ].join('\n');

  var stringifier = new sv.Stringifier({peek: 2, missing: 'NA'});
  var string = '';
  stringifier.on('data', function(chunk) {
    string += chunk.toString();
  });
  stringifier.on('end', function() {
    t.equal(string, expected, 'Stringify output should equal expected.');
    t.end();
  });

  stringifier.write({ index: '1', name: 'chris' });
  stringifier.write({ index: '2', name: 'daniel', time: '1:17' });
  stringifier.write({ index: '3', name: 'lewis', time: '1:30' });
  stringifier.write({ index: '4', name: 'stephen', time: '1:16' });
  stringifier.write({ index: '5', name: 'larry', time: '1:31' });
  stringifier.end();
});
