const fs = require("fs");

RegExp.escape = function (str) {
    return str.replace(/[-[\]{}()*+?.\\^$|,#\s]/g, "\\$&");
};

exports.ROOT = "/";
exports.SEPARATOR = "/";
exports.ALT_SEPARATOR = undefined;

exports.SEPARATORS_RE = function() {
if (
    separatorCached !== exports.SEPARATOR ||
    altSeparatorCached !== exports.ALT_SEPARATOR
) {
    separatorCached = exports.SEPARATOR;
    altSeparatorCached = exports.ALT_SEPARATOR;
    separatorReCached = new RegExp("[" +
        (separatorCached || '').replace(/[-[\]{}()*+?.\\^$|,#\s]/g, "\\$&") +
        (altSeparatorCached || '').replace(/[-[\]{}()*+?.\\^$|,#\s]/g, "\\$&") +
    "]", "g");
}
return separatorReCached;
}
var separatorCached, altSeparatorCached, separatorReCached;

exports.FNM_LEADING_DIR = 1 << 1;
exports.FNM_PATHNAME    = 1 << 2;
exports.FNM_PERIOD      = 1 << 3;
exports.FNM_NOESCAPE    = 1 << 4;
exports.FNM_CASEFOLD    = 1 << 5;
exports.FNM_DOTMATCH    = 1 << 6;

var fnmatchFlags = ["FNM_LEADING_DIR","FNM_PATHNAME","FNM_PERIOD","FNM_NOESCAPE","FNM_CASEFOLD","FNM_DOTMATCH"];

exports.fnmatch = function (pattern, string, flags) {
    var re = exports.patternToRegExp(pattern, flags);
    //print("PATTERN={"+pattern+"} REGEXP={"+re+"}");
    return re.test(string);
}

exports.patternToRegExp = function (pattern, flags) {
    var options = {};
    if (typeof flags === "number") {
        fnmatchFlags.forEach(function(flagName) {
            options[flagName] = !!(flags & exports[flagName]);
        });
    } else if (flags) {
        options = flags;
    }
    
    // FNM_PATHNAME: don't match separators
    var matchAny = options.FNM_PATHNAME ? "[^"+RegExp.escape(exports.SEPARATOR)+"]" : ".";
    
    // FNM_NOESCAPE match "\" separately
    var tokenizeRegex = options.FNM_NOESCAPE ?
        /\[[^\]]*\]|{[^}]*}|[^\[{]*/g :
        /\\(.)|\[[^\]]*\]|{[^}]*}|[^\\\[{]*/g;
    
    return new RegExp(
        '^' + 
        pattern.replace(tokenizeRegex, function (pattern, $1) {
            // if escaping is on, always return the next character escaped
            if (!options.FNM_NOESCAPE && (/^\\/).test(pattern) && $1) {
                return RegExp.escape($1);
            }
            if (/^\[/.test(pattern)) {
                var result = "[";
                pattern = pattern.slice(1, pattern.length - 1);
                // negation
                if (/^[!^]/.test(pattern)) {
                    pattern = pattern.slice(1);
                    result += "^";
                }
                // swap any range characters that are out of order
                pattern = pattern.replace(/(.)-(.)/, function(match, a, b) {
                    return a.charCodeAt(0) > b.charCodeAt(0) ? b + "-" + a : match;
                });
                return result + pattern.split("-").map(RegExp.escape).join("-") + ']';
            }
            if (/^\{/.test(pattern))
                return (
                    '(' +
                    pattern.slice(1, pattern.length - 1)
                    .split(',').map(function (pattern) {
                        return RegExp.escape(pattern);
                    }).join('|') +
                    ')'
                );
            return pattern
            .replace(exports.SEPARATORS_RE(), exports.SEPARATOR)    
            .split(new RegExp(
                exports.SEPARATOR + "?" +
                "\\*\\*" + 
                exports.SEPARATOR + "?"
            )).map(function (pattern) {
                return pattern.split(exports.SEPARATOR).map(function (pattern) {
                    if (pattern == "")
                        return "\\.?";
                    if (pattern == ".")
                        return;
                    if (pattern == "...")
                        return "(|\\.|\\.\\.(" + exports.SEPARATOR + "\\.\\.)*?)";
                    return pattern.split('*').map(function (pattern) {
                        return pattern.split('?').map(function (pattern) {
                            return RegExp.escape(pattern);
                        }).join(matchAny);
                    }).join(matchAny + '*');
                }).join(RegExp.escape(exports.SEPARATOR));
            }).join('.*?');
        }) +
        '$',
        options.FNM_CASEFOLD ? "i" : ""
    );
};

exports.glob = function (pattern, flags) {
    pattern = String(pattern || '');
    var parts = exports.split(pattern),
        paths = ['.'];
    
    if (exports.isAbsolute(pattern))
    {
        paths = parts[0] === '' ? ["/"] : [parts[0]];
        parts.shift();
    }

    if (parts[parts.length-1] == "**")
        parts[parts.length-1] = "*";
    
    parts.forEach(function (part) {
        if (part == "") {
        } else if (part == "**") {
            paths = globTree(paths);
        } else if (part == "...") {
            paths = globHeredity(paths);
        } else if (/[\\\*\?\[{]/.test(part)) {
            paths = globPattern(paths, part, flags);
        } else {
            paths = paths.map(function (path) {
                if (path)
                    return exports.join(path, part);
                return part;
            }).filter(function (path) {
                return exports.exists(path);
            });
        }

        // uniqueness
        var visited = {};
        paths = paths.filter(function (path) {
            var result = !Object.prototype.hasOwnProperty.call(visited, path);
            visited[path] = true;
            return result;
        });

    });
    
    if (paths[0] === "") paths.shift();
    
    return paths;
};

var globTree = function (paths) {
    return Array.prototype.concat.apply(
        [],
        paths.map(function (path) {
            
            if (!(fs.existsSync(path) && fs.lstatSync(path).isDirectory()))
                return [];
            return exports.listDirectoryTree(path).map(function (child) {
                return exports.join(path, child);
            });
        })
    );
};

var globHeredity = function (paths) {
    return Array.prototype.concat.apply(
        [],
        paths.map(function (path) {
            var isRelative = exports.isRelative(path);
            var heredity = [];
            var parts = exports.split(exports.absolute(path));
            if (parts[parts.length - 1] == "")
                parts.pop();
            while (parts.length) {
                heredity.push(exports.join.apply(null, parts));
                parts.pop();
            }
            if (isRelative) {
                heredity = heredity.map(function (path) {
                    return exports.relative("", path);
                });
            }
            return heredity;
        })
    );
};

var globPattern = function (paths, pattern, flags) {
    var re = exports.patternToRegExp(pattern, flags);
    // print("PATTERN={"+pattern+"} REGEXP={"+re+"}");
    // use concat to flatten result arrays
    return Array.prototype.concat.apply([], paths.map(function (path) {
        if (!(fs.existsSync(path) && fs.lstatSync(path).isDirectory()))
            return [];
        return [/*".", ".."*/].concat(exports.list(path)).filter(function (name) {
            return re.test(name);
        }).map(function (name) {
            if (path)
                return exports.join(path, name);
            return name;
        }).filter(function (path) {
            return exports.exists(path);
        });
    }));
};

exports.listDirectoryTree = function (path) {
    path = String(path || '');
    if (!path)
        path = ".";
    var paths = ["."];
    exports.list(path).forEach(function (child) {
        var fullPath = exports.join(path, child);
        if ((fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory())) {
            paths.push.apply(paths, exports.listDirectoryTree(fullPath).map(function(p) {
                return exports.join(child, p);
            }));
        }
    });
    return paths;
};

exports.split = function (path) {
    var parts;
    try {
        parts = String(path).split(exports.SEPARATORS_RE());
    } catch (exception) {
        throw new Error("Cannot split " + (typeof path) + ', "' + path + '"');
    }
    // this special case helps isAbsolute
    // distinguish an empty path from an absolute path
    // "" -> [] NOT [""]
    if (parts.length == 1 && parts[0] == "")
        return [];
    // "a" -> ["a"]
    // "/a" -> ["", "a"]
    return parts;
};

// XXX not standard
exports.isAbsolute = function (path) {
    // for absolute paths on any operating system,
    // the first path component always determines
    // whether it is relative or absolute.  On Unix,
    // it is empty, so ['', 'foo'].join('/') == '/foo',
    // '/foo'.split('/') == ['', 'foo'].
    var parts = exports.split(path);
    // split('') == [].  '' is not absolute.
    // split('/') == ['', ''] is absolute.
    // split(?) == [''] does not occur.
    if (parts.length == 0)
        return false;
    return exports.isDrive(parts[0]);
};

// XXX not standard
exports.isRelative = function (path) {
    return !exports.isAbsolute(path);
};

// XXX not standard
exports.isDrive = function (first) {
    //if (/\bwindows\b/i.test(system.os) || /\bwinnt\b/i.test(system.os)) {
    //    return /:$/.test(first);
    //} else {
        return first == "";
    //}
};

exports.list = function (path) {
    path = String(path || '') || "."; // taken from file.js's list implementation.
    try {
        const result = fs.readdirSync(path, "utf8");
        // Rather than simply return the result array, sort them to ignore case
        // to match the jsc behavior.  This also sorts . before characters which
        // also matches jsc.
        return result.sort(function(a, b) {
            a = a.toLowerCase();
            b = b.toLowerCase();
            return (a > b ? 1 : (a == b ? 0 : -1));
        });
    } catch (e) {
        console.log(e);
        //throwIfAbnormal(e);
    }
    return [];
}

exports.join = function () {
    // special case for root, helps glob
    if (arguments.length == 1 && arguments[0] == "")
        return exports.SEPARATOR; // [""] -> "/"
    // ["", ""] -> "/",
    // ["", "a"] -> "/a"
    // ["a"] -> "a"
    return exports.normal(Array.prototype.join.call(arguments, exports.SEPARATOR));
};

exports.resolve = function () {
    var root = "";
    var parents = [];
    var children = [];
    var leaf = "";
    for (var i = 0; i < arguments.length; i++) {
        var path = String(arguments[i]);
        if (path == "")
            continue;
        var parts = path.split(exports.SEPARATORS_RE());
        if (exports.isAbsolute(path)) {
            root = parts.shift() + exports.SEPARATOR;
            parents = [];
            children = [];
        }
        leaf = parts.pop();
        if (leaf == "." || leaf == "..") {
            parts.push(leaf);
            leaf = "";
        }
        for (var j = 0; j < parts.length; j++) {
            var part = parts[j];
            if (part == "." || part == '') {
            } else if (part == "..") {
                if (children.length) {
                    children.pop();
                } else {
                    if (root) {
                    } else {
                        parents.push("..");
                    }
                }
            } else {
                children.push(part);
            }
        };
    }
    path = parents.concat(children).join(exports.SEPARATOR);
    if (path) leaf = exports.SEPARATOR + leaf;
    return root + path + leaf;
};

exports.normal = function (path) {
    return exports.resolve(path);
};

exports.exists = function (path) {
    try {
        return fs.existsSync(path);
    } catch (e) {
        console.log(e);
        //throwIfAbnormal(e);
    }
    return null;
}
