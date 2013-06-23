'use strict'; /*jslint node: true, es5: true, indent: 2 */
var util = require('util');
var stream = require('stream');
var inference = require('./inference');

/* Parser class
  new Parser();
  - `_bytes_buffer` is a buffer (of bytes) that have yet to be processed.
  - `_cells_buffer` is a list of strings that have yet to be processed.
  - `delimiter` is the field separator used for incoming strings.
  - `columns` is an array of strings used as object keys.
    * They are inferred if they are missing once the headers have been inferred.
  - `missing` is the value we use for 'time' when we have
    `columns = ['index', 'time']` and `write({index: 90})` is called.
    at before inferring headers and flushing
*/
var Parser = module.exports = function(opts) {
  stream.Transform.call(this, {
    decodeStrings: true, // Writable option, ensure _transform always gets a Buffer
    objectMode: true, // Readable option, .read(n) should return a single value, rather than a Buffer
  });
  // this._readableState.objectMode = true; // default
  // decodeStrings: true, dammit! ()
  // stream.Transform({decodeStrings: true}) is not honored if objectMode: true,
  // because objectMode: true (intended for the Readable) overrides the decodeStrings: true
  // if this gets fixed, you can remove the setting below.
  // Issue at https://github.com/joyent/node/issues/5580
  this._writableState.objectMode = false;

  if (opts === undefined) opts = {};
  this.missing = opts.missing || ''; // should be a string
  this.delimiter = opts.delimiter;
  this.columns = opts.columns;
  this.encoding = opts.encoding;
  this.escapechar = (opts.escapechar || '\\').charCodeAt(0);
  this.quotechar = (opts.quotechar || '"').charCodeAt(0);
  this.double_quotechar_regex = new RegExp(String.fromCharCode(this.quotechar) + String.fromCharCode(this.quotechar), 'g');

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
    this.push(inference.zip(this.columns, cells, this.missing));
  }
};

Parser.prototype._flush = function(callback, nonfinal) {
  var buffer = this._bytes_buffer;
  var cells = this._cells_buffer;

  if (!this.delimiter) {
    // should we wait for some minimum amount of data?
    this.delimiter = inference.delimiter(buffer);
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
    if (!eos && buffer[i] == this.escapechar) {
      // excel is bizarre. An escape before a quotechar doesn't count,
      // so we only increment if the next character is not a quotechar
      if (buffer[i+1] != this.quotechar) {
        i++;
      }
    }
    else if (!eos && buffer[i] == this.quotechar) {
      // if we are inside, and on a "
      if (inside_quote) {
        // handle excel dialect: double quotechar => single literal quotechar
        if (buffer[i+1] == this.quotechar) {
          // double quotechar
          // we just advance over it for now, so that we can put this back on the buffer, if needed.
          i++;
        }
        else {
          // lone quotechar -> don't assume that they're always followed by a delimiter.
          // they might be followed by a newline
          // and we advance so that buffer[i] skips over the delimiter
          inside_quote = false;
          outside_quote = true;
        }
      }
      // if we are not inside, and on a "
      else {
        inside_quote = true;
      }
    }
    // otherwise we just wait for the delimiter
    else if (
      // if we are at the very end of the input and this is the final chunk (ignoring any sort of state)
      eos ||
      // OR, we push a new cell whenever we hit a delimiter (say, tab) and are not inside a quote
      (!inside_quote && (buffer[i] == 13 || buffer[i] == 10 || buffer[i] == this.delimiter))
      ) {
      // add the unprocessed buffer to our cells
      // inside_quote might be true if the file ends on a quote
      if (eos) i++;

      if (inside_quote || outside_quote) {
        var trimmed_cell = buffer.toString(this.encoding, start + 1, i - 1);
        // is this good enough?
        cells.push(trimmed_cell.replace(this.double_quotechar_regex, String.fromCharCode(this.quotechar)));
        outside_quote = false;
      }
      else {
        cells.push(buffer.toString(this.encoding, start, i));
      }

      // handle \r, \r\n, or \n (but not \n\n) as one line break
      // '\r' == 13, '\n' == 10
      // we flush the row, also, if we are at the end and this is the final chunk
      if (eos || (buffer[i] != this.delimiter)) {
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
