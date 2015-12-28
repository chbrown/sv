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
