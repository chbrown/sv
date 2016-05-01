// import {describe, it} from 'mocha';
import {deepEqual} from 'assert';
import {readFileSync, createReadStream} from 'fs';
import {readToEnd} from 'streaming';

import {Parser} from '../index';

const basenames = [
  'excel-quoting',
  'r-write-table',
  'simple-csv',
];

describe('input/output pairs', () => {
  // it's the goddamn tests, we can use sync
  basenames.forEach(basename => {
    it(`should parse pairs/${basename}.csv to match pairs/${basename}.json`, (done) => {
      const gold = JSON.parse(readFileSync(`${__dirname}/pairs/${basename}.json`, {encoding: 'utf8'}));
      // console.error('JSON>>', json_filename, group);
      const stream = createReadStream(`${__dirname}/pairs/${basename}.txt`);
      readToEnd(stream.pipe(new Parser()), (err, rows) => {
        if (err) return done(err);
        deepEqual(rows, gold);
        done();
      });
    });
  });
});
