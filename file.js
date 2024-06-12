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
        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
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
        rm_rf(to);

    if (fs.lstatSync(from).isDirectory())
        copyRecursiveSync(from, to);
    else
    {
        try
        {
            fs.copyFileSync(from, to);
        }
        catch (e)
        {
            print(e + fs.existsSync(from) + " " + fs.existsSync(path.dirname(to)));
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
