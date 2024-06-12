const fs = require('fs');
const path = require('path');

// from stackoverflow
exports.copyRecursiveSync = function (src, dest) {
    var exists = fs.existsSync(src);
    var stats = exists && fs.statSync(src);
    var isDirectory = exists && stats.isDirectory();
    if (isDirectory)
    {
      fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach(function(childItemName)
      {
        exports.copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    }
    else
    {
      fs.copyFileSync(src, dest);
    }
};

exports.cp_r = function(/*String*/ from, /*String*/ to)
{
    if (fs.existsSync(to))
        exports.rm_rf(to);

    if (fs.lstatSync(from).isDirectory())
        exports.copyRecursiveSync(from, to);
    else
    {
        try
        {
            fs.copyFileSync(from, to);
        }
        catch (e)
        {
            console.log(e + fs.existsSync(from) + " " + fs.existsSync(path.dirname(to)));
        }
    }
};

exports.cp = function(/*String*/ from, /*String*/ to)
{
    fs.copyFileSync(from, to)
//    FILE.chmod(to, FILE.mod(from));
};

exports.mv = function(/*String*/ from, /*String*/ to)
{
    fs.renameSync(from, to);
};

exports.rm_rf = function(/*String*/ aFilename)
{
    try { fs.rmSync(aFilename, {recursive: true, force: true}); }
    catch (anException)
    {
        console.log(anException);
    }
};

exports.enquote = function(word)
{
    return "'" + String(word).replace(/'/g, "'\"'\"'") + "'";
}

/**
 * parses command line arguments
 * @param command {String} a command composed of space delimited,
 * quoted, or backslash escaped arguments.
 * @returns an Array of unquoted arguments.
 *
 * /!\ WARNING: this does not handle all of the edge cases
 * of command line argument parsing, nor is suitable for
 * general purpose argument enquoting on all platforms.  It
 * also will never be able to handle environment variable
 * interpolation or other forms of shell quote expansion.
 * This utility is used by Cappuccino to parse arguments from
 * system.env.OBJJ_OPT.
 */

var STATE_NORMAL    = 0; // waiting for non whitespace/quote
var STATE_ARG       = 1; // nextArg is an argument, even if empty
var STATE_IN_QUOTE  = 2; // within a ' or " quote

exports.parse = function (argString) {
    var args = [];

    var nextArg = "";
    var state = STATE_NORMAL;
    var escapeNext = false;
    var delimiter;

    var tokens = argString.split("");
    while (tokens.length > 0) {
        var token = tokens.shift();

        if (state === STATE_NORMAL || state === STATE_ARG) {
            if (!escapeNext && token === "\\") {
                escapeNext = true;
            }
            else if (escapeNext) {
                state = STATE_ARG;
                escapeNext = false;
                nextArg += token;
            }
            else if (token === "'" || token === '"') {
                delimiter = token;
                state = STATE_IN_QUOTE;
            }
            else if (token === " ") {
                if (state === STATE_ARG) {
                    args.push(nextArg);
                    nextArg = "";
                }
                state = STATE_NORMAL;
            }
            else {
                nextArg += token;
                state = STATE_ARG;
            }
        }
        else if (state === STATE_IN_QUOTE) {
            if (!escapeNext && token === "\\") {
                escapeNext = true;
            }
            else if (delimiter === token) {
                if (escapeNext) {
                    nextArg += token;
                    escapeNext = false;
                } else {
                    state = STATE_ARG;
                }
            }
            else {
                if (escapeNext) {
                    // if not a quote (above) or other special character that needs to be escaped then include the backslash
                    if (token !== "\\")
                        nextArg += "\\";
                    nextArg += token;
                    escapeNext = false;
                } else {
                    nextArg += token;
                }
            }
        }
        else {
            throw "wtf " + state;
        }
    }

    if (state === STATE_IN_QUOTE) {
        if (token === delimiter) {
            args.push(nextArg.slice(0,-1) + "\\");
        }
        else {
            // throw "Invalid or not yet implemented case"
        }
    }
    else if (state === STATE_ARG) {
        args.push(nextArg);
    }

    return args;
};
