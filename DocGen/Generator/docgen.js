
var fs = require('fs');
var yaml = require('js-yaml');
var cheerio = require('cheerio');

/**
* DocGen class
*/

function DocGen() {

	this.loadTemplate = function () {
		fs.readFile('Resources/template.html', 'utf8', function (err, template) {
		  if (err) {
		    return console.log(err);
		  }
		  $ = cheerio.load(template);
		  console.log($('title').text());
		});
	};

	this.run = function () {
		this.loadTemplate();
	}

};

var generator = new DocGen();
generator.loadTemplate();
