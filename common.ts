/**
- `encoding` for converting to strings.
- `missing` is the value we use for 'time' when we have `columns = ['index', 'time']` and `write({index: 90})` is called.
- `columns` is an array of strings used as object keys. Inferred by default (but after inferring `delimiter`)
- `delimiter` is the field separator used for incoming strings, ',' for csv, '\t' for tsv, etc.
- `quote` is the value that designates a string in which there might be delimiters to ignore. Defaults to '"'
- `escape` is the character that escapes special characters in a quoted field
*/
export interface Configuration {
  /** character encoding */
  encoding?: string;
  /** string to represent missing data */
  missing?: string;
  /** string to separate rows */
  newline?: string;
  /** string to separate cells in a single row */
  delimiter?: string;
  /** string to use to nest cell content which contains special characters,
      like newline or delimiter */
  quotechar?: string;
  /** the character that escapes special characters in a quoted field */
  escape?: string;
  /** the list of columns */
  columns?: string[];
}

/**
Like reverse Object.assign, but with special treatment for undefined.
*/
export function merge(target, ...sources) {
  sources.forEach(source => {
    Object.keys(source).filter(key => source.hasOwnProperty(key)).forEach(key => {
      if (target[key] === undefined) {
        target[key] = source[key];
      }
    });
  });
  return target;
}

export function zip(keys, values, missing) {
  var obj = {};
  for (var i = 0, l = keys.length; i < l; i++) {
    obj[keys[i]] = values[i] || missing;
  }
  return obj;
}

export function commonPrefix(filepaths) {
  var prefix = filepaths[0];
  for (var filepath, i = 1; (filepath = filepaths[i]) && prefix.length; i++) {
    for (var c = 0; prefix[c] == filepath[c]; c++);
    prefix = prefix.slice(0, c);
  }
  return prefix;
}

export function countLinebreaks(stream, callback: (error: Error, lines: number) => void) {
  var count = 0;
  stream
  .on('data', buffer => {
    for (var i = 0; i < buffer.length; i++) {
      // universal newlines: handle \r (13), \r\n (13, 10), or \n (10) as one line break
      if (buffer[i] == 13) {
        count++;
        if (buffer[i+1] == 10) {
          i++;
        }
      }
      else if (buffer[i] == 10) {
        count++;
      }
    }
  })
  .on('end', () => callback(null, count))
  .on('error', err => callback(err, count));
}
