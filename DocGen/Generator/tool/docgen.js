
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
	var parameters;
	var tableOfContents;

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

	var loadJSON = function (url) {
		var promise = new rsvp.Promise(function (resolve, reject) {
			fs.readFile ('src/contents.json', 'utf8', function (error, data) {
	   			if (error) {
		      		reject(error);
	    		}
				resolve(data);
			});
		});
		return promise;
	};

	this.run = function () {

		//this.loadTemplate();
		//this.loadConfig();
		//this.loadPages();
		//this.callExternal();
		//this.writeFiles();

		loadJSON('src/contents.json').then(function (json) {
			console.log(json);
		//  	return loadJSON('src/parameters.json');
		//}).then(function (json) {
		//	console.log(json);
		  // proceed with access to post and comments
		}).catch(function (error) {
			console.log(error);
		});
	}
}

module.exports = DocGen;
