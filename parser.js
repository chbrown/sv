'use strict'; /*jslint node: true, es5: true, indent: 2 */
var fs = require('fs');
var util = require('util');
var stream = require('stream');
var inference = require('./inference');

var Parser = module.exports = function(opts) {
  /** new Parser(opts)

  Options (`opts`):

  - `encoding` for converting to strings.
  - `missing` is the value we use for 'time' when we have `columns = ['index', 'time']` and `write({index: 90})` is called.
  - `columns` is an array of strings used as object keys. Inferred by default (but after inferring `delimiter`)

  - `delimiter` is the field separator used for incoming strings, ',' for csv, '\t' for tsv, etc.
  - `quote` is the value that designates a string in which there might be delimiters to ignore. Defaults to '"'
  - `escape` is the character that escapes special characters in a quoted field

  Private values:

  - `_bytes_buffer` is a buffer (of bytes) that have yet to be processed (and sent to output).
  - `_cells_buffer` is a list of strings that have yet to be processed (and sent to output).
  - etc.

  */
  stream.Transform.call(this, {
    decodeStrings: true, // Writable option, ensure _transform always gets a Buffer
    objectMode: true, // Readable option, .read(n) should return a single value, rather than a Buffer
  });
  // this._readableState.objectMode = true; // default, good
  // decodeStrings: true, dammit! ()
  // stream.Transform({decodeStrings: true}) is not honored if objectMode: true,
  // because objectMode: true (intended for the Readable) overrides the decodeStrings: true
  // if this gets fixed, you can remove the private field setting below.
  // Issue at https://github.com/joyent/node/issues/5580
  this._writableState.objectMode = false;

  if (opts === undefined) opts = {};

  // arbitrary settings (non-inferrable, but with sane & safe defaults)
  this.encoding = opts.encoding;
  this.missing_string = opts.missing || ''; // should be a string
  this.columns = opts.columns;

  // special demarcating characters
  // 1. delimiter
  this._delimiter_byte = opts.delimiter ? opts.delimiter.charCodeAt(0) : null;

  // 2. quote
  this._quote_string = opts.quote || '"';
  this._quote_byte = this._quote_string.charCodeAt(0);
  this._quotequote_regex = new RegExp(this._quote_string + this._quote_string, 'g');

  // 3. escape
  var escape_string = opts.escape || '\\';
  this._escape_byte = escape_string.charCodeAt(0);
  this._escapequote_regex = new RegExp('\\' + escape_string + this._quote_string, 'g');

  // private storage
  this._bytes_buffer = new Buffer(0);
  this._cells_buffer = [];
};
util.inherits(Parser, stream.Transform);

Parser.prototype._row = function(cells) {
  if (!this.columns) {
    // we don't emit the column names as data
    this.columns = cells;
  }
  else {
    this.push(inference.zip(this.columns, cells, this.missing_string));
  }
};

Parser.prototype._flush = function(callback, nonfinal) {
  var buffer = this._bytes_buffer;
  var cells = this._cells_buffer;

  if (!this._delimiter_byte) {
    // should we wait for some minimum amount of data?
    this._delimiter_byte = inference.delimiter(buffer);
  }

  var start = 0;
  var end = buffer.length;
  var inside_quote = false;
  // outside_quote reminds us to remove the quotes later (in pushCell)
  var outside_quote = false;

  for (var i = 0; i < end; i++) {
    var eos = !nonfinal && i + 1 == end;
    // var snippet = buffer.toString('utf8', 0, i) +
    //   '\x1b[7m' + buffer.toString('utf8', i, i + 1) + '\x1b[0m' +
    //   buffer.toString('utf8', i + 1, end);
    // console.error(snippet.replace(/\n/g, 'N').replace(/\t/g, 'T'), inside_quote ? 'inside_quote' : '');

    // if we are on an escape char, simply skip over it (++) and the (default)
    if (!eos && buffer[i] == this._escape_byte) {
      // excel is bizarre. An escape before a quotebyte doesn't count,
      //   so we only increment if the next character is not a quotebyte
      // unless we are not inside quotes, in which case we do skip over it.
      if (!inside_quote || buffer[i+1] !== this._quote_byte) {
        i++;
      }
    }
    else if (!eos && buffer[i] === this._quote_byte && inside_quote) {
      // if we are inside, and on a "
      // handle excel dialect: double quotebyte => single literal quotebyte
      if (buffer[i+1] === this._quote_byte) {
        // double quotebyte
        // we just advance over it for now, so that we can put this back on the buffer, if needed.
        i++;
      }
      else {
        // lone quotebyte -> don't assume that they're always followed by a delimiter.
        // they might be followed by a newline
        // and we advance so that buffer[i] skips over the delimiter
        inside_quote = false;
        outside_quote = true;
      }
    }
    else if (!eos && buffer[i] === this._quote_byte && !inside_quote && i == start) {
      // if we are not already inside, and on a "
      inside_quote = true;
      // we can only enter a quote at the edge of the cell (thus, i == start)
    }
    // otherwise we just wait for the delimiter
    else if (
      // if we are at the very end of the input and this is the final chunk (ignoring any sort of state)
      eos ||
      // OR, we push a new cell whenever we hit a delimiter (say, tab) and are not inside a quote
      (!inside_quote && (buffer[i] == 13 || buffer[i] == 10 || buffer[i] == this._delimiter_byte))
      ) {

      // this generally won't hurt, since it will only go to the end of the buffer anyway.
      if (eos) i++;

      // add the unprocessed buffer to our cells
      // inside_quote might be true if the file ends on a quote
      if (inside_quote || outside_quote) {
        var trimmed_cell = buffer.toString(this.encoding, start + 1, i - 1);
        if (this._quotequote_regex) {
          trimmed_cell = trimmed_cell.replace(this._quotequote_regex, this._quote_string);
        }
        // is this good enough?
        cells.push(trimmed_cell);
        outside_quote = inside_quote = false;
      }
      else {
        var cell = buffer.toString(this.encoding, start, i);
        if (this._escapequote_regex) {
          cell = cell.replace(this._escapequote_regex, this._quote_string);
        }
        cells.push(cell);
      }

      // handle \r, \r\n, or \n (but not \n\n) as one line break
      // '\r' == 13, '\n' == 10
      // we flush the row, also, if we are at the end and this is the final chunk
      if (eos || (buffer[i] != this._delimiter_byte)) {
        // add these cells to the emit queue
        this._row(cells);

        // and reset them
        cells = [];

        // also consume a following \n, if this was \r, and there is one.
        if (buffer[i] == 13 && buffer[i+1] == 10) {
          i++;
        }
      }
      start = i + 1;
    }
  }

  // save whatever we have yet to process
  this._bytes_buffer = buffer.slice(start, end);
  this._cells_buffer = cells;

  // if there was a trailing newline, this._buffer.length = 0
  callback();
};

Parser.prototype._transform = function(chunk, encoding, callback) {
  // we'll assume that we always get chunks with the same encoding.
  if (!this.encoding && encoding != 'buffer') {
    this.encoding = encoding;
  }

  // collect unused buffer and new chunk into a single buffer
  this._bytes_buffer = this._bytes_buffer.length ? Buffer.concat([this._bytes_buffer, chunk]) : chunk;

  // do all the processing
  this._flush(callback, true);
};

Parser.readToEnd = function(filename, opts, callback) {
  // `opts` is optional, `callback` is required
  //   callback signature: function(err, rows) --> rows is a list of objects
  if (callback === undefined) {
    callback = opts;
    opts = undefined;
  }
  var rows = [];
  var filepath = filename.replace(/^~/, process.env.HOME);
  return fs.createReadStream(filepath, opts).pipe(new Parser(opts))
  .on('error', function(err) {
    callback(err);
  })
  .on('data', function(row) {
    rows.push(row);
  })
  .on('end', function() {
    callback(null, rows);
  });
};
