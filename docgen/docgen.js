
var rsvp = require('rsvp');
var fs = require('fs');
var cheerio = require('cheerio');
var marked = require('marked');
var moment = require('moment');
var ncp = require ('ncp');
var childProcess = require("child_process");
var schemaValidator = require("z-schema");
var chalk = require('chalk');
var spawnArgs = require('spawn-args');

/**
* DocGen class
*/

function DocGen ()
{
    var version = '2.0.0';
    var wkhtmltopdfVersion = 'wkhtmltopdf 0.12.2.1 (with patched qt)'; //output from wkhtmltopdf -V
    var options;
    var templates = {};
    var meta = {};
    var pages = {};

    this.getVersion = function () {
        return version;
    }

    this.setOptions = function (userOptions) {
        options = userOptions;
    }

    this.run = function () {
        console.log(chalk.green.bold('DocGen version '+version));
        loadTemplates();
    }

    /*
        read any file
    */

    var readFile = function (path) {
        return new rsvp.Promise(function (resolve, reject) {
            fs.readFile (path, 'utf8', function (error, data) {
                if (error) {
                    console.log(chalk.red('Error reading file: '+path));
                    reject(error);
                }
                resolve(data);
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
                    console.log(chalk.red('Error writing file: '+path));
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
        console.log(chalk.green('Loading templates'));
        var files = {
            main: readFile('docgen/templates/main.html'),
            pdfCover: readFile('docgen/templates/pdfCover.html'),
            pdfHeader: readFile('docgen/templates/pdfHeader.html'),
            pdfFooter: readFile('docgen/templates/pdfFooter.html'),
        };
        rsvp.hash(files).then(function(files) {
            for (var key in files) {
                if (files.hasOwnProperty(key)) { //ignore prototype
                    var file = files[key].replace(/^\uFEFF/, ''); //remove BOM, if present
                    var dom = cheerio.load(file);
                    templates[key] = dom;
                }
            }
            loadMeta();
        }).catch(function(error) {
            console.log(chalk.red('Error loading templates'));
            console.log(error);
        });
    }

    /*
        JSON schema validation
    */

    var schemas = {
        "parameters" : {
            title: "DocGen Parameters Schema",
            type: "object",
            required: [
                "title",
                "version",
                "date",
                "organization",
                "author",
                "owner",
                "contributors",
                "website",
                "module",
                "id",
                "summary",
                "marking",
                "legalese"
            ],
            properties: {
                title: { type: "string" },
                version: { type: "string" },
                date: { type: "string" },
                organization: {
                    type : "object",
                    required: [ "name", "url"],
                    properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                    }
                },
                author: {
                    type : "object",
                    required: [ "name", "url"],
                    properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                    }
                },
                owner: {
                    type : "object",
                    required: [ "name", "url"],
                    properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                    }
                },
                contributors: {
                    type : "array",
                    items: { oneOf: [ { 
                        type: "object",
                        required: [ "name", "url"],
                        properties: {
                            name: { type: "string" },
                            url: { type: "string" },
                        }
                    }]}
                },
                website: {
                    type : "object",
                    required: [ "name", "url"],
                    properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                    }
                },
                module: { type: "string" },
                id: { type: "string" },
                summary: { type: "string" },
                marking: { type: "string" },
                legalese: { type: "string" },
            }
        },
        "contents" : {
            title: "DocGen Table of Contents Schema",
            type : "array",
            items: { oneOf: [ { 
                type: "object",
                required: [ "heading", "column", "links"],
                properties: {
                    name: { type: "string" },
                    column: { type: "integer" },
                    links: {
                        type : "array",
                        items: { oneOf: [ { 
                            type: "object",
                            required: [ "title", "src"],
                            properties: {
                                title: { type: "string" },
                                url: { type: "string" },
                            }
                        }]}
                    },
                }
            }]}
        }
    };

    var validateJSON = function (key, data) {
        var schema = schemas[key];
        var validator = new schemaValidator();
        var valid = validator.validate(data, schema);
        if (!valid) {
            console.log(chalk.red('Error parsing required file: '+key+'.json (failed schema validation)'));
            //console.log(validator.getLastError());
        }
        return valid;
    }

    /*
        load all metadata files (JSON)
    */

    var loadMeta = function () {
        console.log(chalk.green('Loading required JSON files'));
        var files = {
            parameters: readFile(options.input+'/parameters.json'),
            contents: readFile(options.input+'/contents.json'),
        };
        rsvp.hash(files).then(function(files) {
            for(var key in files) {
                if (files.hasOwnProperty(key)) { //ignore prototype
                    try {
                        var file = JSON.parse(files[key]);
                        if (validateJSON(key, file)) {
                            meta[key] = file;
                        } else {
                            //die?
                        }
                    } catch (error) {
                        console.log(chalk.red('Error parsing required file: '+key+'.json (invalid JSON)'));
                        //console.log(error);
                    }
                }
            }
            loadMarkdown();
        }).catch(function(error) {
            console.log(chalk.red('Error loading required JSON files'));
            //console.log(error);
        });
    }

    /*
        load all markdown files (source)
    */

    var loadMarkdown = function () {
        console.log(chalk.green('Loading Markdown files'));
        var keys = [];
        var files = [];
        meta.contents.forEach( function (section) {
            section.links.forEach( function (page) {
                keys.push(page.src);
                files.push(options.input+'/'+page.src);
            });
        });
        rsvp.all(files.map(readFile)).then(function (files) {
            files.forEach( function (page, index) {
                try{
                    var html = marked(page);
                    var key = keys[index];
                    pages[key] = html;
                } catch (error) {
                    console.log(chalk.red('Error parsing Markdown file: '+file.src));
                    //console.log(error);
                }
            });
            process(); 
        }).catch(function(error) {
            console.log(chalk.red('Error loading Markdown files'));
            //console.log(error);
        });
    }

    /*
        build the HTML for the table of contents
    */

    var webToc = function () {
        var $ = templates.main;
        var html = [], i = -1;
        html[++i] = '<div><table><tr>';
        meta.contents.forEach( function (section) {
            html[++i] = '<td class="toc-group"><ul><li class="toc-heading">'+section.heading+'</li>';
            section.links.forEach( function (page) {
                var name = page.src.substr(0, page.src.lastIndexOf('.'));
                var path = name+'.html';
                html[++i] = '<li><a href="'+path+'">'+page.title+'</a></li>';
            });
            html[++i] = '</li></ul></td>';
        });
        //fixed-width column at end
        html[++i] = '<td class="toc-group" id="toc-fixed-column"><ul>';
        html[++i] = '<li><span class="w-icon toc-icon" data-name="person_group" title="archive"></span><a href="cover.html">Ownership</a></li>';
        html[++i] = '<li><span class="w-icon toc-icon" data-name="refresh" title="archive"></span><a href="change-log.html">Release Notes</a></li>';
        html[++i] = '</ul><div>';
        if (options.pdf) {
            html[++i] = '<button class="w-icon-button" onclick="window.location=\'user-guide.pdf\';">';
            html[++i] = '<span class="w-icon" data-name="document"></span>';
            html[++i] = '<span>PDF copy</span>';
            html[++i] = '</button>';
        }
        html[++i] = '</div></td>';
        html[++i] = '</tr></table></div>';
        $('#toc').html(html.join(''));
        templates.main = $;
    }

    /*
        insert the parameters into all templates
    */

    var insertParameters = function () {

        var date = moment().format('DD/MM/YYYY');
        var time = moment().format('HH:mm:ss');
        var year = moment().format('YYYY');
        var attribution = 'Created by DocGen '+version+' on '+date+' at '+time+'.';

        var author = '';
        if (meta.parameters.author.url !== '') {
            author += '<a href="'+meta.parameters.author.url+'">'+meta.parameters.author.name+'</a>';
        } else {
            author += meta.parameters.author.name;
        }

        var owner = '';
        if (meta.parameters.owner.url !== '') {
            owner += '<a href="'+meta.parameters.owner.url+'">'+meta.parameters.owner.name+'</a>';
        } else {
            owner += meta.parameters.owner.name;
        }

        var organization = '';
        if (meta.parameters.organization.url !== '') {
            organization += '<a href="'+meta.parameters.organization.url+'">'+meta.parameters.organization.name+'</a>';
        } else {
            organization += meta.parameters.organization.name;
        }

        var website = '';
        if (meta.parameters.website.url !== '') {
            website += '<a href="'+meta.parameters.website.url+'">'+meta.parameters.website.name+'</a>';
        } else {
            website += meta.parameters.websitename;
        }

        var contributors = '';
        meta.parameters.contributors.forEach (function (contributor) {
            if (contributor.url !== '') {
                contributors += '<a href="'+contributor.url+'">'+contributor.name+'</a>, ';
            } else {
                contributors += contributor.name+', ';
            }
        });
        contributors = contributors.replace(/,\s*$/, ""); //remove trailing commas

        var copyright = '&copy; '+year+' '+organization;

        var webTitle = meta.parameters.title

        var webFooter = 'Version '+meta.parameters.version+' released on '+meta.parameters.date+'.';

         for (var key in templates) {
            if (templates.hasOwnProperty(key)) { //ignore prototype
                $ = templates[key];
                $('#dg-title').text(meta.parameters.title);
                $('#dg-owner').html(owner);
                $('#dg-version').text(meta.parameters.version);
                $('#dg-web-title-version').text('('+meta.parameters.version+')');  
                $('#dg-release-date').text(meta.parameters.date);
                $('#dg-web-footer').text(webFooter);
                $('#dg-author').html(author);                
                $('#dg-contributors').html(contributors);
                $('#dg-module').text(meta.parameters.module);
                $('#dg-id').html(meta.parameters.id);
                $('#dg-website').html(website);
                $('#dg-summary').text(meta.parameters.summary);
                $('#dg-copyright').html(copyright);
                $('#dg-marking').text(meta.parameters.marking);
                $('#dg-legalese').text(meta.parameters.legalese);
                $('#dg-attribution').text(attribution);
            }
        }
    }

    /*
        process each input into an output
    */

    var process = function () {
        console.log(chalk.green('Generating the web content'));
        webToc();
        insertParameters();
        meta.contents.forEach( function (section) {
            section.links.forEach( function (page) {
                var $ = cheerio.load(templates.main.html()); //todo - better implementation of clone?
                var key = page.src;
                var content = pages[key];
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
        console.log(chalk.green('Writing the web page files'));
        var promises = {};
        meta.contents.forEach( function (section) {
            section.links.forEach( function (page) {
                var key = page.src;
                var name = key.substr(0, page.src.lastIndexOf('.'));
                var path = options.output+'/'+name+'.html';
                var html = pages[key].html();
                promises[key] = writeFile(path, html);
            });
        });
        //add extra files
        promises['docgenPdfCover'] = writeFile(options.output+'/pdfCover.html', templates.pdfCover.html());
        promises['docgenPdfHeader'] = writeFile(options.output+'/pdfHeader.html', templates.pdfHeader.html());
        promises['docgenPdfFooter'] = writeFile(options.output+'/pdfFooter.html', templates.pdfFooter.html());
        rsvp.hash(promises).then(function (files) {
            copyRequire();
            copyUserFiles();
            preparePdfTemplates();
        }).catch(function(error) {
            console.log(chalk.red('Error writing the web page files'));
            console.log(error);
        });
    }

    /*
        copy the require directory (CSS, JavaScript)
    */

    var copyRequire = function () {
        ncp('docgen/require', options.output+'/require', function (error) {
            if (error) {
                console.log(chalk.red('Error copying the require directory'));
                //console.error(err);
            }
        });
    }

    /*
        copy the files directory (user attached files)
    */

    var copyUserFiles = function () {
        ncp(options.input+'/files', options.output+'/files', function (error) {
            if (error) {
                console.log(chalk.red('Error copying the attached files'));
                //console.error(err);
            }
        });
    }

    /*
        insert the parameters into the PDF templates, and copy them to a temporary directory
    */

    var preparePdfTemplates = function () {
        createPdf();
    }

    /*
        wkthmltopdf options
    */

    var pdfOptions = [
        ' --zoom 1.0',
        ' --image-quality 100',
        ' --print-media-type',
        ' --orientation portrait',
        ' --page-size A4',
        ' --margin-top 25',
        ' --margin-right 15',
        ' --margin-bottom 16',
        ' --margin-left 15',
        ' --header-spacing 5',
        ' --footer-spacing 5',
        ' --javascript-delay 1000' //code syntax highlight in wkhtmltopdf 0.12.2.1 fails without a delay (but why doesn't --no-stop-slow-scripts work?)
    ];

    var getPdfArguments = function () {
        pdfOptions.push(' --user-style-sheet docgen/pdf-stylesheet.css');
        pdfOptions.push(' --header-html '+options.output+'/pdfHeader.html');
        pdfOptions.push(' --footer-html '+options.output+'/pdfFooter.html');
        pdfOptions.push(' cover '+options.output+'/pdfCover.html');
        pdfOptions.push(' toc --xsl-style-sheet docgen/pdf-contents.xsl');
        var allPages = '';
        meta.contents.forEach( function (section) {
            section.links.forEach( function (page) {
                var key = page.src;
                var name = key.substr(0, page.src.lastIndexOf('.'));
                var path = options.output+'/'+name+'.html';
                allPages += ' '+path;
            });
        });
        var args = pdfOptions.join('');
        args += allPages;
        args += ' '+options.output+'/user-guide.pdf';
        return spawnArgs(args);
    }

    var createPdf = function () {
        if (options.pdf === true) {
            console.log(chalk.green('Creating the PDF copy'));
            //first check that wkhtmltopdf is installed
            childProcess.exec('wkhtmltopdf -V', function (error, stdout, stderr) {
                if (error) {
                    console.log(chalk.red('Unable to run wkhtmltopdf'));
                    //console.log(error);
                } else {
                    //warn if the version of wkhtmltopdf is not an expected version
                    var actualWkhtmltopdfVersion = stdout.trim();
                    if (actualWkhtmltopdfVersion !== wkhtmltopdfVersion) {
                        var warning = 'Warning: unexpected version of wkhtmltopdf, which may work but is not tested or supported';
                        var expectedVersion = '   expected version: '+wkhtmltopdfVersion;
                        var detectedVersion = '   detected version: '+actualWkhtmltopdfVersion;
                        console.log(chalk.yellow(warning));
                        console.log(chalk.yellow(expectedVersion));
                        console.log(chalk.yellow(detectedVersion));
                    }
                    generatePdf();
                }
            });
        } else {
            cleanUp();
        }
    }

    /*
        call wkhtmltopdf as an external executable
    */

    var generatePdf = function () {
        var args = getPdfArguments();
        var wkhtmltopdf = childProcess.spawn('wkhtmltopdf', args);

        wkhtmltopdf.on('error', function( error ){ console.log(error) });

        wkhtmltopdf.stdout.on('data', function (data) {
            //console.log(data);
        });
                
        wkhtmltopdf.stderr.on('data', function (data) {
            //console.log(data);
        });
                
        wkhtmltopdf.on('close', function (code) {
            cleanUp();
        });
    }

    /*
        cleanup
    */

    var cleanUp = function () {
        console.log(chalk.green.bold('Complete'));
    }
}

module.exports = DocGen;
