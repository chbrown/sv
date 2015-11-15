var json_1 = require('streaming/json');
var property_1 = require('streaming/property');
var fs_1 = require('fs');
var async_1 = require('async');
// import * as optimist from 'optimist';
var optimist = require('optimist');
var parser_1 = require('./parser');
exports.Parser = parser_1.Parser;
var stringifier_1 = require('./stringifier');
exports.Stringifier = stringifier_1.Stringifier;
function pluck(xs, prop) {
    return xs.map(function (x) { return x[prop]; });
}
var whitespace_literals = {
    '\r': '\\r',
    '\n': '\\n',
    '\t': '\\t',
};
function escapeWhitespace(s) {
    return whitespace_literals[s];
}
function transform(input, parserConfig, stringifierConfig, callback) {
    // if (filename) {
    //   console.error('Transforming ' + filename);
    // }
    var transforms = [
        parserConfig.json ? new json_1.Parser() : new parser_1.Parser(parserConfig),
    ];
    if (stringifierConfig.omit) {
        transforms.push(new property_1.Omitter(stringifierConfig.omit.split(/,/g)));
    }
    if (stringifierConfig.filter) {
        transforms.push(new property_1.Picker(stringifierConfig.filter.split(/,/g)));
    }
    var stringifier = stringifierConfig.json ? new json_1.Stringifier() : new stringifier_1.Stringifier(stringifierConfig);
    transforms.push(stringifier);
    var output = transforms.reduce(function (outputStream, transform) { return outputStream.pipe(transform); }, input).pipe(process.stdout);
    output.on('finish', callback);
    output.on('error', function (error) {
        // panic! (lets us quit faster, actually)
        input.unpipe();
        // output.unpipe();
        callback(error);
    });
}
exports.transform = transform;
function main() {
    var argvparser = optimist
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
        .string(['delimiter', 'quotechar', 'escapechar'])
        .boolean(['json', 'verbose', 'version', 'in-json'])
        .alias({
        j: 'json',
        v: 'verbose',
    })
        .default({
        width: process.stdout['columns'] || 80,
    });
    var argv = argvparser.argv;
    var parser_opts = {
        delimiter: argv['in-delimiter'],
        quotechar: argv['in-quotechar'],
        json: argv['in-json'],
    };
    var stringifier_opts = {
        delimiter: argv['out-delimiter'],
        quotechar: argv['out-quotechar'],
        peek: argv.peek,
        filter: argv.filter,
        omit: argv.omit,
        json: argv.json,
        width: argv.width,
    };
    function exit(err) {
        if (err && err.code != 'EPIPE') {
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
    else if (!process.stdin['isTTY']) {
        // process.stdin.setEncoding('utf8');
        transform(process.stdin, parser_opts, stringifier_opts, exit);
    }
    else if (argv._.length) {
        var filepaths = argv._;
        async_1.eachSeries(filepaths, function (filepath, callback) {
            var stream = fs_1.createReadStream(filepath);
            transform(stream, parser_opts, stringifier_opts, callback);
            console.error(''); // newline
        }, exit);
    }
    else {
        argvparser.showHelp();
        console.error('You must supply data via STDIN or as unflagged command line arguments.');
    }
}
exports.main = main;
