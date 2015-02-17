
var fs = require('fs');
var yaml = require('js-yaml');
var cheerio = require('cheerio');

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

	this.table_of_contents = {

	}

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
		  var doc = yaml.safeLoad(fs.readFileSync('sample_document.yml', 'utf8'));
		  console.log(doc);
		} catch (e) {
		  console.log(e);
		}
	}

	this.writeFiles = function () {
		
	}

	this.run = function () {
		this.loadTemplate();
		this.loadConfig();
		this.writeFiles();
	}

};

var generator = new DocGen();
generator.run();
