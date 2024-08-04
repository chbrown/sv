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
  encoding?: BufferEncoding;
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
export function merge(target: {[index: string]: any}, ...sources: {[index: string]: any}[]) {
  sources.forEach(source => {
    Object.keys(source).filter(key => source.hasOwnProperty(key)).forEach(key => {
      if (target[key] === undefined) {
        target[key] = source[key];
      }
    });
  });
  return target;
}

export function zip<T>(keys: string[], values: T[], missing: T) {
  const object: {[index: string]: T} = {};
  for (let i = 0, l = keys.length; i < l; i++) {
    object[keys[i]] = values[i] || missing;
  }
  return object;
}
