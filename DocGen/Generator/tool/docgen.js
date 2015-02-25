
var rsvp = require('rsvp');
var fs = require('fs');
var cheerio = require('cheerio');
var marked = require('marked');
var child_process = require("child_process");

/**
* DocGen class
*/

function DocGen (options)
{
    var options = options;
    var templates = {};
    var meta = {};
    var pages = {};

    this.callExternal = function () {
        var child = child_process.exec('ls', function (error, stdout, stderr) {
            console.log(stdout);
        });
    }

    /*
        read any file
    */

    var readFile = function (path) {
        return new rsvp.Promise(function (resolve, reject) {
            fs.readFile (path, 'utf8', function (error, data) {
                if (error) {
                    reject(error);
                }
                try{
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /*
        write any file
    */

    var writeFile = function (path, data) {
        return new rsvp.Promise(function (resolve, reject) {
            fs.writeFile(path, data, function (error) {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /*
        load all HTML template files
    */

    var loadTemplates = function () {
        var files = {
            main: readFile('tool/templates/main.html'),
        };
        rsvp.hash(files).then(function(files) {
            for (var key in files) {
                if (files.hasOwnProperty(key)) { //ignore prototype
                    var dom = cheerio.load(files[key]);
                    templates[key] = dom;
                }
            }
            loadMeta();
        }).catch(function(error) {
            console.log(error);
        });
    }

    /*
        load all metadata files (JSON)
    */

    var loadMeta = function () {
        var files = {
            parameters: readFile('src/parameters.json'),
            contents: readFile('src/contents.json'),
        };
        rsvp.hash(files).then(function(files) {
            for(var key in files) {
                if (files.hasOwnProperty(key)) { //ignore prototype
                    try{
                        //todo - validate json against a schema
                        var result = JSON.parse(files[key]);
                        meta[key] = result;
                    } catch (error) {
                        console.log(error);
                    }
                }
            }
            loadMarkdown();
        }).catch(function(error) {
            console.log(error);
        });
    }

    /*
        load all markdown files (source)
    */

    var loadMarkdown = function () {
        var keys = [];
        var files = [];
        meta.contents.forEach( function (section) {
            section.links.forEach( function (page) {
                keys.push(page.src);
                files.push('src/'+page.src);
            });
        });
        rsvp.all(files.map(readFile)).then(function (files) {
            files.forEach( function (page, index) {
                try{
                    var html = marked(page);
                    var key = keys[index];
                    pages[key] = html;
                } catch (error) {
                    console.log(error);
                }
            });
            process(); 
        }).catch(function(error) {
            console.log(error);
        });
    }

    /*
        process each input into an output
    */

    var process = function () {
        meta.contents.forEach( function (section) {
            section.links.forEach( function (page) {
                var key = page.src;
                var content = pages[key];
                var $ = templates.main;
                $('#content').html(content);
                pages[key] =  $;
            });
        });
        writePages();
    }

    /*
        write each html page
    */

    var writePages = function () {
        var promises = {};
        meta.contents.forEach( function (section) {
            section.links.forEach( function (page) {
                var key = page.src;
                var name = key.substr(0, page.src.lastIndexOf('.'));
                var path = 'out/'+name+'.html';
                var html = pages['index.txt'].html();
                promises[key] = writeFile(path, html);
            });
        });

        rsvp.hash(promises).then(function (files) {
             
        }).catch(function(error) {
            console.log(error);
        });
    }

    this.run = function () {
        loadTemplates();
    }
}

module.exports = DocGen;
