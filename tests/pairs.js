import assert from 'assert';
import {describe, it} from 'mocha';
import {readFileSync, createReadStream} from 'fs';
import {readToEnd} from 'streaming';

import * as sv from '..';

const basenames = [
  'excel-quoting',
  'r-write-table',
  'simple-csv',
];

describe('input/output pairs', () => {
  // it's the goddamn tests, we can use sync
  basenames.forEach(basename => {
    it(`should parse pairs/${basename}.csv to match pairs/${basename}.json`, (done) => {
      var gold = JSON.parse(readFileSync(`${__dirname}/pairs/${basename}.json`));
      // console.error('JSON>>', json_filename, group);
      var stream = createReadStream(`${__dirname}/pairs/${basename}.txt`);
      readToEnd(stream.pipe(new sv.Parser()), (err, rows) => {
        if (err) return done(err);
        assert.deepEqual(rows, gold);
        done();
      });
    });
  });
});
