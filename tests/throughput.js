import assert from 'assert';
import {describe, it} from 'mocha';
import {readToEnd} from 'streaming';
import {Picker, Omitter} from 'streaming/property';

import * as sv from '..';

describe('throughput', () => {

  it('passthrough', done => {
    var input = [
      { index: '1', name: 'chris', time: '1:29' },
      { index: '2', name: 'daniel', time: '1:17' },
      { index: '3', name: 'lewis', time: '1:30' },
      { index: '4', name: 'stephen', time: '1:16' },
      { index: '5', name: 'larry', time: '1:31' },
    ];

    var stringifier = new sv.Stringifier({peek: 2, missing: 'NA'});

    var parser = stringifier.pipe(new sv.Parser());
    readToEnd(parser, (err, output) => {
      assert.deepEqual(output, input, 'Throughput should be transparent.');
      done();
    });

    input.forEach((record) => stringifier.write(record));
    stringifier.end();
  });

  it('filter', done => {
    var parser = new sv.Parser();
    var filter = new Picker(['index', 'name']);
    parser.pipe(filter);

    parser.end([
      'index,name,time',
      '1,chris,NA',
      '2,daniel,1:17',
      '3,lewis,1:30',
      '4,stephen,1:16',
      '5,larry,1:31',
    ].join('\n'));

    readToEnd(filter, (err, output) => {
      assert.equal(output[2].name, 'lewis', 'Third row should have name of "lewis"');
      assert.ok(!output[1].time, 'No row should have a "time" field.');
      assert.ok(output[0].index, 'First row should have an "index" field.');
      done();
    });
  });

  it('omitter', done => {
    var parser = new sv.Parser();
    var omitter = new Omitter(['index', 'name']);
    parser.pipe(omitter);

    parser.end([
      'index,name,time',
      '1,chris,NA',
      '2,daniel,1:17',
      '3,lewis,1:30',
      '4,stephen,1:16',
      '5,larry,1:31',
    ].join('\n'));

    readToEnd(omitter, (err, output) => {
      assert.equal(output[2].time, '1:30', 'Third row should have time of "1:30"');
      assert.ok(!output[1].index, 'No row should have an "index" field.');
      assert.ok(output[0].time, 'First row should have a "time" field.');
      done();
    });
  });

});
