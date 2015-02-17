
var fs = require('fs');
var yaml = require('js-yaml');
var cheerio = require('cheerio');
var marked = require('marked');

var child_process = require("child_process");

/**
* DocGen class
*/

function DocGen() {

	this.settings = {
		output_path: '../output',
  		output_filename: 'documentation',
  		output_dirname: 'Docs',
  		homepage: 'index.html',
  		suppress_IE_warning: false,
  		generate_page_TOC: false
	}

	this.documentSettings = {
		name: 'Empty Template',
		owner: 'Department',
		author: '',
		email: '',
		module: '',
		module_id: '',
		release: '',
		summary: 'This is the empty template for DocGen.\n',
		company: 'Company Name',
		protective_marking: 'Document protective marking',
		legalese: 'Copyright notices. \n'
	}

	this.table_of_contents = [
		{ heading: 'Quick Start',
		  column: 1,
		  links: [ { title: 'Overview', url: 'index.txt' } ] }
	];

	this.pages = [];

	this.loadTemplate = function () {
		fs.readFile('Resources/template.html', 'utf8', function (err, template) {
		  if (err) {
		    return console.log(err);
		  }
		  $ = cheerio.load(template);
		  console.log($('title').text());
		});
	};

	this.loadConfig = function () {
		try {
		  var doc = yaml.safeLoad(fs.readFileSync('example.yml', 'utf8'));
		  //console.log(doc);
		} catch (e) {
		  console.log(e);
		}
	}

	this.loadPages = function () {

		this.table_of_contents.forEach( function (section) {
			section.links.forEach( function (page) {
				
				fs.readFile(page.url, {encoding: 'utf-8'}, function (err, data) {
				    if (!err) {
				    	console.log(marked(data));
				    } else {
				        console.log(err);
				    }
				});

			}, this);
		}, this);

	}

	this.writeFiles = function () {

	}

	this.callExternal = function () {
		var child = child_process.exec('ls', function (error, stdout, stderr) {
			console.log(stdout);
		});
	}

	this.run = function () {
		this.loadTemplate();
		this.loadConfig();
		this.loadPages();
		this.callExternal();
		this.writeFiles();
	}

};

var generator = new DocGen();
generator.run();
