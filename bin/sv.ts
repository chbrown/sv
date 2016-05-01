#!/usr/bin/env node
import * as optimist from 'optimist';
import {createReadStream} from 'fs';
import {eachSeries} from 'async';

import {transform} from '../index';

export function main() {
  let argvparser = optimist
  .usage([
    'Consolidate any tabular format.',
    '',
    'Usage: <sprints.txt sv [options] > sprints.csv',
    '   or: sv [options] ~/Desktop/**/*.csv > ~/all.csv',
    '',
    'Parser options:',
    '  --in-delimiter    field separator (inferred if unspecified)',
    '  --in-quotechar "  ',
    '  --in-json         parse input as JSON (one object per row)',
    '',
    'Stringifier options:',
    '  --peek 10         infer columns from first ten objects of input',
    '  --out-delimiter , field separator',
    '  --out-quotechar " marks beginning and end of fields containing delimiter',
    '  --filter a,b      keep only fields a and b in the results',
    '  --omit c,d        leave out fields x and y from the results (processed before filter)',
    '  -j, --json        write one JSON object per row',
    '',
    'Other options:',
    '      --version       print version and quit',
    '  -v  --verbose       turn up the verbosity (still all on STDERR)',
    '',
    'STDIN, if supplied, will be coerced to utf8',
  ].join('\n'))
  .options({
    json: {
      alias: 'j',
      type: 'boolean',
    },
    'in-json': {
      type: 'boolean',
    },
    delimiter: {
      type: 'string',
    },
    quotechar: {
      type: 'string',
    },
    escapechar: {
      type: 'string',
    },
    help: {
      alias: 'h',
      describe: 'print this help message',
      type: 'boolean',
    },
    verbose: {
      alias: 'v',
      describe: 'print extra output',
      type: 'boolean',
    },
    version: {
      describe: 'print version',
      type: 'boolean',
    },
  });

  const argv = argvparser.argv;
  const parser_opts = {
    delimiter: argv['in-delimiter'],
    quotechar: argv['in-quotechar'],
    json: argv['in-json'],
  };
  const stringifier_opts = {
    delimiter: argv['out-delimiter'],
    quotechar: argv['out-quotechar'],
    peek: argv.peek,
    filter: argv.filter,
    omit: argv.omit,
    json: argv.json,
    width: argv.width,
  };

  function exit(err: NodeJS.ErrnoException) {
    if (err && err.code !== 'EPIPE') {
      throw err;
    }
    // if err.code == 'EPIPE' that just means that someone down
    // the line cut us short with a | head or something

    if (argv.verbose) {
      console.error('Done.');
    }
    // process.exit(); // wait for stdout to finish, actually.
  }

  if (argv.help) {
    argvparser.showHelp();
    console.log('ARGV: ' + process.argv.join(' '));
    if (argv.verbose) {
      console.log('  argv: ' + JSON.stringify(argv, null, '  ').replace(/\n/g, '\n  '));
    }
    console.log('  parser options: ' + JSON.stringify(parser_opts, null, '  ').replace(/\n/g, '\n  '));
    console.log('  stringifier options: ' + JSON.stringify(stringifier_opts, null, '  ').replace(/\n/g, '\n  '));
  }
  else if (argv.version) {
    console.log(require('../package').version);
  }
  else if (process.stdin['isTTY'] === false) {
    // process.stdin.setEncoding('utf8');
    transform(process.stdin, parser_opts, stringifier_opts, exit);
  }
  else if (argv._.length) {
    const filepaths: string[] = argv._;
    eachSeries(filepaths, (filepath, callback) => {
      const stream = createReadStream(filepath);
      transform(stream, parser_opts, stringifier_opts, callback);
      console.error(''); // newline
    }, exit);
  }
  else {
    argvparser.showHelp();
    console.error('You must supply data via STDIN or as unflagged command line arguments.');
  }
}

if (require.main === module) {
  main();
}
