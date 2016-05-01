// import {describe, it} from 'mocha';
import {equal} from 'assert';

import {Parser} from '../index';

describe('quotes', () => {
  it('should read the excel dialect properly', (done) => {
    const input = [
      'index\tname\ttime',
      '1\t"chris ""breezy"" brown"\t1:20',
      '2\tstephen\t"1:21"""',
      '3\tlordy\t"1:22""x"',
      '4\t"zam\n""managua"""\t1:23',
    ].join('\n');

    const rows = [];
    const parser = new Parser();
    parser.on('data', function(obj) {
      rows.push(obj);
    });
    parser.end(input, function() {
      equal(rows.length, 4, 'There should be four rows.');
      equal(rows[0].name, 'chris "breezy" brown', 'The paired double quotes should be interpreted as just one double quote.');
      equal(rows[1].time, '1:21"', 'Lone triple quotes signify an escaped quote and then end of field.');
      equal(rows[2].time, '1:22"x', 'Paired double quotes should collapse to just one.');
      equal(rows[3].name, 'zam\n"managua"', 'Retain double quote at end of field.');
      done();
    });
  });

  it('should recognize quoted newlines', (done) => {
    const input = [
      'index  name  time',
      '1  "chris\ngrant\nbrown" 1:49',
      '2  "stephen\nhodgins" 1:50',
    ].join('\n');

    const rows = [];
    const parser = new Parser();
    parser.on('data', function(obj) {
      rows.push(obj);
    });
    parser.end(input, function() {
      // t.equal(found, wanted, ...)
      equal(rows.length, 2, 'There should be exactly two rows.');
      equal(rows[0].name, 'chris\ngrant\nbrown', 'Newlines should be retained.');
      done();
    });
  });
});
