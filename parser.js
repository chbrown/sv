var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var stream_1 = require('stream');
var common_1 = require('./common');
exports.defaultParserConfiguration = {
    encoding: 'utf8',
    missing: '',
    newline: '\n',
    // omit delimiter so that it gets inferred
    quotechar: '"',
    escape: '\\',
};
/**
- `byteBuffer` is a buffer (of bytes) that have yet to be processed (and sent to output).
- `cellBuffer` is a list of strings that have yet to be processed (and sent to output).

*/
var Parser = (function (_super) {
    __extends(Parser, _super);
    function Parser(config) {
        if (config === void 0) { config = {}; }
        _super.call(this, {
            decodeStrings: true,
            objectMode: true,
        });
        this.byteBuffer = new Buffer(0);
        this.cellBuffer = [];
        // this._readableState.objectMode = true; // default, good
        // decodeStrings: true, dammit! ()
        // stream.Transform({decodeStrings: true}) is not honored if objectMode: true,
        // because objectMode: true (intended for the Readable) overrides the decodeStrings: true
        // if this gets fixed, you can remove the private field setting below.
        // Issue at https://github.com/joyent/node/issues/5580
        this['_writableState'].objectMode = false;
        // merge defaults
        this.config = common_1.merge(config, exports.defaultParserConfiguration);
        // special demarcating characters
        // 1. delimiter
        if (this.config.delimiter) {
            this.delimiterByte = this.config.delimiter.charCodeAt(0);
        }
        // 2. quote
        this.quoteByte = this.config.quotechar.charCodeAt(0);
        this.quotequoteRegExp = new RegExp(this.config.quotechar + this.config.quotechar, 'g');
        // 3. escape
        this.escapeByte = this.config.escape.charCodeAt(0);
        this.escapeQuoteRegExp = new RegExp('\\' + this.config.escape + this.config.quotechar, 'g');
    }
    Parser.prototype.writeRow = function (cells) {
        if (!this.config.columns) {
            // we don't emit the column names as data
            this.config.columns = cells;
        }
        else {
            this.push(common_1.zip(this.config.columns, cells, this.config.missing));
        }
    };
    Parser.prototype.flush = function (callback, nonfinal) {
        var buffer = this.byteBuffer;
        var cells = this.cellBuffer;
        if (!this.delimiterByte) {
            // should we wait for some minimum amount of data?
            this.delimiterByte = common_1.inferDelimiter(buffer);
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
            if (!eos && buffer[i] == this.escapeByte) {
                // excel is bizarre. An escape before a quotebyte doesn't count,
                //   so we only increment if the next character is not a quotebyte
                // unless we are not inside quotes, in which case we do skip over it.
                if (!inside_quote || buffer[i + 1] !== this.quoteByte) {
                    i++;
                }
            }
            else if (!eos && buffer[i] === this.quoteByte && inside_quote) {
                // if we are inside, and on a "
                // handle excel dialect: double quotebyte => single literal quotebyte
                if (buffer[i + 1] === this.quoteByte) {
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
            else if (!eos && buffer[i] === this.quoteByte && !inside_quote && i == start) {
                // if we are not already inside, and on a "
                inside_quote = true;
            }
            else if (
            // if we are at the very end of the input and this is the final chunk (ignoring any sort of state)
            eos ||
                // OR, we push a new cell whenever we hit a delimiter (say, tab) and are not inside a quote
                (!inside_quote && (buffer[i] == 13 || buffer[i] == 10 || buffer[i] == this.delimiterByte))) {
                // this generally won't hurt, since it will only go to the end of the buffer anyway.
                if (eos)
                    i++;
                // add the unprocessed buffer to our cells
                // inside_quote might be true if the file ends on a quote
                if (inside_quote || outside_quote) {
                    var trimmed_cell = buffer.toString(this.config.encoding, start + 1, i - 1);
                    if (this.quotequoteRegExp) {
                        trimmed_cell = trimmed_cell.replace(this.quotequoteRegExp, this.config.quotechar);
                    }
                    // is this good enough?
                    cells.push(trimmed_cell);
                    outside_quote = inside_quote = false;
                }
                else {
                    var cell = buffer.toString(this.config.encoding, start, i);
                    if (this.escapeQuoteRegExp) {
                        cell = cell.replace(this.escapeQuoteRegExp, this.config.quotechar);
                    }
                    cells.push(cell);
                }
                // handle \r, \r\n, or \n (but not \n\n) as one line break
                // '\r' == 13, '\n' == 10
                // we flush the row, also, if we are at the end and this is the final chunk
                if (eos || (buffer[i] != this.delimiterByte)) {
                    // add these cells to the emit queue
                    this.writeRow(cells);
                    // and reset them
                    cells = [];
                    // also consume a following \n, if this was \r, and there is one.
                    if (buffer[i] == 13 && buffer[i + 1] == 10) {
                        i++;
                    }
                }
                start = i + 1;
            }
        }
        // save whatever we have yet to process
        this.byteBuffer = buffer.slice(start, end);
        this.cellBuffer = cells;
        // if there was a trailing newline, this._buffer.length = 0
        callback();
    };
    Parser.prototype._flush = function (callback) {
        return this.flush(callback, false);
    };
    Parser.prototype._transform = function (chunk, encoding, callback) {
        // we'll assume that we always get chunks with the same encoding.
        if (!this.config.encoding && encoding != 'buffer') {
            this.config.encoding = encoding;
        }
        // collect unused buffer and new chunk into a single buffer
        this.byteBuffer = this.byteBuffer.length ? Buffer.concat([this.byteBuffer, chunk]) : chunk;
        // do all the processing
        this.flush(callback, true);
    };
    return Parser;
})(stream_1.Transform);
exports.Parser = Parser;
