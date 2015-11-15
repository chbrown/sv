var sv = require('./'); // require('sv') elsewhere

function stringify() {
  var expenses = [
    {name: 'Tip'                },
    {name: 'Lunch', amount: 5.90},
    {name: 'Latte', amount: 3.15},
    {name: 'Paper', amount: 2.10},
    {name: 'Pens' , amount: 4.59},
    {               amount: 9.16}
  ];

  var stringifier = new sv.Stringifier({peek: 2, missing: 'n/a'});
  stringifier.pipe(process.stdout);
  expenses.forEach(function(expense) {
    stringifier.write(expense);
  });
  stringifier.end();
}

function parse() {
  var doc = [
    'name,amount',
    'Tip,n/a',
    'Lunch,5.9',
    'Latte,3.15',
    'Paper,2.1',
    'Pens,4.59',
    'n/a,9.16'
  ].join('\n');

  var parser = new sv.Parser();
  parser.on('data', function(row) {
    console.log(row);
  });
  parser.end(doc);
}

function stdin() {
  var parser = new sv.Parser();
  // logEvents(parser, 'parser', ['finish', 'close', 'drain', 'error']);
  // logEvents(process.stdout, 'process.stdout', ['end', 'finish', 'close', 'drain', 'error']);
  // process.stdout.on('error', function(row) {
  //   console.log('error', row);
  // });
  parser.on('data', function(row) {
    console.log(row);
  });
  // parser.pipe(process.stdout);
  process.stdin.pipe(parser);
}

console.log("stringify example");
stringify();

console.log("parse example");
parse();
