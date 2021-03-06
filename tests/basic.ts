// import {describe, it} from 'mocha';
import {ok, equal} from 'assert';
import {readToEnd} from 'streaming';

import {Parser, Stringifier} from '../index';

describe('basic', () => {
  it('should parse a literal string into some objects', (done) => {
    const input = [
      'index	name	time',
      '1	chris	1:18',
      '2	daniel	1:17',
      '3	lewis	1:30',
      '4	stephen	1:16',
      '5	larry	1:31',
    ].join('\n');

    const parser = new Parser();
    readToEnd(parser, (err, rows) => {
      ok(rows[2], 'There should be a third row');
      equal(rows[2].name, 'lewis', 'The name attribute of the third row should be "lewis"');
      done();
    });
    parser.end(input);
  });

  it('should stringify some objects to the expected string', (done) => {
    const expected = [
      'index,name,time',
      '1,chris,NA',
      '2,daniel,1:17',
      '3,lewis,1:30',
      '4,stephen,1:16',
      '5,larry,1:31',
      '', // trailing newline
    ].join('\n');

    const stringifier = new Stringifier({peek: 2, missing: 'NA'});
    readToEnd(stringifier, (err, chunks) => {
      equal(chunks.join(''), expected, 'Stringify output should equal expected.');
      done();
    });

    stringifier.write({ index: '1', name: 'chris' });
    stringifier.write({ index: '2', name: 'daniel', time: '1:17' });
    stringifier.write({ index: '3', name: 'lewis', time: '1:30' });
    stringifier.write({ index: '4', name: 'stephen', time: '1:16' });
    stringifier.write({ index: '5', name: 'larry', time: '1:31' });
    stringifier.end();
  });
});
