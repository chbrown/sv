import {ok, equal, deepEqual} from 'assert';
import {readToEnd} from 'streaming';
import {Picker, Omitter} from 'streaming/property';
// import {describe, it} from 'mocha';

import {Parser, Stringifier} from '../index';

describe('throughput', () => {

  it('passthrough', done => {
    const input = [
      { index: '1', name: 'chris', time: '1:29' },
      { index: '2', name: 'daniel', time: '1:17' },
      { index: '3', name: 'lewis', time: '1:30' },
      { index: '4', name: 'stephen', time: '1:16' },
      { index: '5', name: 'larry', time: '1:31' },
    ];

    const stringifier = new Stringifier({peek: 2, missing: 'NA'});

    const parser = stringifier.pipe(new Parser());
    readToEnd(parser, (err, output) => {
      deepEqual(output, input, 'Throughput should be transparent.');
      done();
    });

    input.forEach((record) => stringifier.write(record));
    stringifier.end();
  });

  it('filter', done => {
    const parser = new Parser();
    const filter = new Picker(['index', 'name']);
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
      equal(output[2].name, 'lewis', 'Third row should have name of "lewis"');
      ok(!output[1].time, 'No row should have a "time" field.');
      ok(output[0].index, 'First row should have an "index" field.');
      done();
    });
  });

  it('omitter', done => {
    const parser = new Parser();
    const omitter = new Omitter(['index', 'name']);
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
      equal(output[2].time, '1:30', 'Third row should have time of "1:30"');
      ok(!output[1].index, 'No row should have an "index" field.');
      ok(output[0].time, 'First row should have a "time" field.');
      done();
    });
  });

});
