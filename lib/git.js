var debug = require("debug")("release-notes:git");
var parser = require("debug")("release-notes:parser");

exports.log = function (options, callback) {
    var spawn = require("child_process").spawn;
    var gitArgs = ["log", "--no-color", "--no-merges", "--branches=" + options.branch, "--format=" + formatOptions, options.range];
    debug("Spawning git with args %o", gitArgs);
    var gitLog = spawn("git", gitArgs, {
        cwd : options.cwd,
        stdio : ["ignore", "pipe", process.stderr]
    });

    var allCommits = "";

    gitLog.stdout.on("data", function (data) {
        allCommits += data;
    });

    gitLog.on("exit", function (code) {
        debug("Git command exited with code '%d'", code);
        if (code === 0) {
            allCommits = normalizeNewlines(allCommits).trim();

            if (allCommits) {
                // Build the list of commits from git log

                //Building defects
                var commits = processDefects(allCommits, 0);
                var tasks = processDefects(allCommits, 1);
                var stories = processDefects(allCommits, 2);

                callback(commits,tasks,stories,options);
            } else {
                callback([]);
            }
        }
    });
};

var newCommit = "___";
var formatOptions = [
    newCommit, "sha1:%H", "authorName:%an", "authorEmail:%ae", "authorDate:%aD",
    "committerName:%cn", "committerEmail:%ce", "committerDate:%cD",
    "title:%s", "%w(80,1,1)%b"
].join("%n");


function processDefects (commitMessages, options)
{
    // This return an object with the same properties described above
    var stream = commitMessages.split("\n");
    var commits = [];
    var workingCommit;
    parser("Parsing Defects Iterating on %d lines", stream.length);
    stream.forEach(function (rawLine) {
        parser("Raw line\n\t%s", rawLine);
        var line = parseLine(rawLine);
        parser("Parsed line %o", line);

        if (line.type === "new") {
            workingCommit = {
                messageLines : []
            };
            commits.push(workingCommit);
        }
        else if(line.type === "title" || line.type === "message") {
            workingCommit.messageLines.push(line.message);
        }
    });


    //Parse Commits
    var scrubbedCommits = [];

    if(options === 0)
    {
        scrubbedCommits = parseCommits(commits, 0);
    }
    else if(options === 1)
    {
        scrubbedCommits = parseCommits(commits, 1);
    }
    else{
        scrubbedCommits = parseCommits(commits, 2);
    }

    return scrubbedCommits;
}

function parseLine (line) {
    if (line === newCommit) {
        return {
            type : "new"
        };
    }

    var match = line.match(/^([a-zA-Z]+1?)\s?:\s?(.*)$/i);

    if (match) {
        return {
            type : match[1],
            message : match[2].trim()
        };
    } else {
        return {
            type : "message",
            message : line.substring(1) // padding
        };
    }
}

function parseCommits(commits,type) {

    var tempSearch = "#DE";
    if(type == 1)
    {
        tempSearch = "#TA";
    }
    else if(type == 2)
    {
        tempSearch = "#US";
    }

    var tempCommits = [];
    for (var i = 0; i < commits.length; i++) {
        for (var j = 0; j < commits[i].messageLines.length; j++) {
            if (commits[i].messageLines[j].indexOf(tempSearch) !== -1) {
                //Contains a #
                var tempSplit = commits[i].messageLines[j].split(/[ ,]+/);
                for (var k = 0, len = tempSplit.length; k < len; k++) {
                    parser(tempSplit[i]);

                    if (tempSplit[k].indexOf(tempSearch) == 0) {
                        //Match - Add to list
                        tempCommits.push(tempSplit[k].substring(1));
                    }
                }
            }
        }
    }


    //Remove dups
    var dedupeArray = tempCommits.filter(function(elem, pos) { return tempCommits.indexOf(elem) == pos;});

    return dedupeArray.sort();
}

function normalizeNewlines(message) {
    return message.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, '');
}
