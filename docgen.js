
var docgen = require ('./docgen/docgen.js');
var program = require('commander');
var EOL = require('os').EOL;

var generator = new docgen();

function scaffold (command) {
	generator.setOptions(command);
	generator.scaffold();
}

function run (command) {
	generator.setOptions(command);
	generator.run();
}

/*
	parse command-line arguments with node commander
		commander help: http://slides.com/timsanteford/conquering-commander-js
		command-line conventions: http://docopt.org
*/

program
	.version(generator.getVersion())
	.usage('[command] [--option]');

program.command('scaffold')
	.description('create a template input directory')
	.option('-o, --output [path]', 'path to the output directory (default: ./)', './')
	.option('-v, --verbose', 'show verbose output including detailed errors')
	.action(function (command) {
		scaffold(command);
	})

program.command('run')
	.description('create a static website from an input directory')
	.option('-i, --input [path]', 'path to the input directory [default: ./]', './')
	.option('-o, --output [path]', 'path to the output directory [default: ./output]', './output')
	.option('-p, --pdf', 'create a PDF document')
	.option('-r, --redirect', 'create an index.html in the parent directory that redirects to the homepage')
	.option('-v, --verbose', 'show verbose output including detailed errors')
	.action(function (command) {
		run(command);
	});

program.parse(process.argv);

//if no arguments were provided, show help and then exit
if (!process.argv.slice(2).length) {
	program.help();
}
