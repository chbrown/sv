/**
Like reverse Object.assign, but with special treatment for undefined.
*/
function merge(target) {
    var sources = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sources[_i - 1] = arguments[_i];
    }
    sources.forEach(function (source) {
        Object.keys(source).filter(function (key) { return source.hasOwnProperty(key); }).forEach(function (key) {
            if (target[key] === undefined) {
                target[key] = source[key];
            }
        });
    });
    return target;
}
exports.merge = merge;
function zip(keys, values, missing) {
    var obj = {};
    for (var i = 0, l = keys.length; i < l; i++) {
        obj[keys[i]] = values[i] || missing;
    }
    return obj;
}
exports.zip = zip;
function inferColumns(rows) {
    var columns = [];
    var seen = {};
    rows.forEach(function (row) {
        // each object might be a string, array, or object, but only objects matter here.
        if (typeof (row) !== 'string' && !Array.isArray(row)) {
            Object.keys(row).forEach(function (key) {
                // if (row.hasOwnProperty(key)) {
                // maybe should also check that row[key] != null
                if (!(key in seen)) {
                    columns.push(key);
                    seen[key] = 1;
                }
                // }
            });
        }
    });
    return columns;
}
exports.inferColumns = inferColumns;
/**
returns a single char code (a byte) denoting the inferred delimiter.
*/
function inferDelimiter(buffer) {
    var counts = {};
    // we look at the first newline or 256 chars, whichever is greater,
    //   but without going through the whole file
    var upto = Math.min(256, buffer.length);
    for (var i = 0; i < upto && buffer[i] != 10 && buffer[i] != 13; i++) {
        var char_code = buffer[i];
        counts[char_code] = (counts[char_code] || 0) + 1;
    }
    // we'll go through, prioritizing characters that aren't likely to show
    // up unless they are a delimiter.
    var candidates = [
        9,
        59,
        44,
        32,
    ];
    // TODO: make this more robust (that's why I even counted them)
    for (var candidate, j = 0; (candidate = candidates[j]); j++) {
        if (counts[candidate] > 0) {
            return candidate;
        }
    }
}
exports.inferDelimiter = inferDelimiter;
function commonPrefix(filepaths) {
    var prefix = filepaths[0];
    for (var filepath, i = 1; (filepath = filepaths[i]) && prefix.length; i++) {
        for (var c = 0; prefix[c] == filepath[c]; c++)
            ;
        prefix = prefix.slice(0, c);
    }
    return prefix;
}
exports.commonPrefix = commonPrefix;
function countLinebreaks(stream, callback) {
    var count = 0;
    stream
        .on('data', function (buffer) {
        for (var i = 0; i < buffer.length; i++) {
            // universal newlines: handle \r (13), \r\n (13, 10), or \n (10) as one line break
            if (buffer[i] == 13) {
                count++;
                if (buffer[i + 1] == 10) {
                    i++;
                }
            }
            else if (buffer[i] == 10) {
                count++;
            }
        }
    })
        .on('end', function () { return callback(null, count); })
        .on('error', function (err) { return callback(err, count); });
}
exports.countLinebreaks = countLinebreaks;
