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
