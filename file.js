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
