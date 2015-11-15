# sv

For all your separated value needs.

* `sv.Stringifier` is a [Readable stream](http://nodejs.org/api/stream.html#stream_class_stream_readable).
* `sv.Parser` is a [Writable stream](http://nodejs.org/api/stream.html#stream_class_stream_writable).

## Install

    npm install sv

The `optimist` dependency is only required for command line use.

## API usage

All tabular data must / will have column names on the first row.

### Parsing

sprints.csv:

    index	name	time
    1	chris	1:18
    2	daniel	1:17
    3	lewis	1:30
    4	stephen	1:16
    5	larry	1:32

And in node:

    var sv = require('sv');
    var parser = new sv.Parser();
    parser.on('data', function(obj) {
      console.log('sprinter ->', obj);
    });

    var fs = require('fs');
    var sprints = fs.createReadStream('sprints.csv', {encoding: 'utf8'});
    sprints.pipe(parser);

### Stringifying

    var expenses = [
      {name: 'Tip'                },
      {name: 'Lunch', amount: 5.90},
      {name: 'Latte', amount: 3.15},
      {name: 'Paper', amount: 2.10},
      {name: 'Pens' , amount: 4.59},
      {               amount: 9.16}
    ];

    var sv = require('sv');
    var stringifier = new sv.Stringifier({peek: 2, missing: 'n/a'});
    stringifier.pipe(process.stdout);
    expenses.forEach(function(expense) {
      stringifier.write(expense);
    });

    // if you write set 'peek' to more rows than you have in your data,
    // you'll need to call stringifier end so that they get flushed.
    stringifier.end();

* N.b.: If you pipe a buffer or (i.e., with a stringifier) into a parser, the
  parser will not receive any encoding. You _must_ set the encoding on the
  parser in those cases.

### Stringifier features:

1. Infer column names from a list of objects.
2. Convert from objects to csv / tsv plaintext.
   * Also allows writing arrays / strings directly.
3. Write header automatically.

### Parser features:

1. Infer delimiter from input.
2. Infer column names from first line of input.
3. Handle universal newlines (`\r`, `\r\n`, or `\n`).

## CLI usage

    shopt -s globstar
    for csv in ~/corpora/testsheets/**/*.csv; do
      echo
      file "$csv"
      echo "Tunneling through multiple 'sv' calls should be transparent."
      cat "$csv" | sv -j | wc -l
      cat "$csv" | sv | sv -j | wc -l
    done

## TODO

* Decide how to encode a field like {id: 1, name: '"chris'},
  when the delimiter is `,` and quotechar is `"`.
  - This is weird because it doesn't *need* quoting, but without, the
    quotechar marker will trigger an `inside` state, but there's no end quote.)


# Development notes

## Characters codes

Line separators:

* `\n` = 10 (newline)
* `\r` = 13 (return)

Field separators:

* `\t` = 9 (tab)
* ` ` = 32 (space)
* `,` = 44 (comma)
* `;` = 59 (semicolon)

Field quotations:

* `"` = 34 (double quote)
* `'` = 39 (single quote)
* <code>`</code> = 96 (backtick)

Escapes:

* `\` = 92 (backslash)

## Debugging helper:

    function logEvents(emitter, prefix, names) {
      names.forEach(function(name) {
        emitter.on(name, function(/*...*/) {
          console.error(prefix + ':' + name, arguments);
        });
      });
    }


## License

Copyright 2013-2015 Christopher Brown. [MIT Licensed](http://chbrown.github.io/licenses/MIT/#2013-2015).
