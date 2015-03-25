
var docgen = require ('./docgen/docgen.js');
var options = require('commander');

var generator = new docgen();

options
	.version(generator.getVersion())
	.option('-i, --input [type]', 'path to the input directory (default: pwd)', 'pwd')
	.option('-o, --output [type]', 'path to the output directory (default: ./outputs)', './output')
	.option('-p, --pdf [type]', 'create a PDF copy (default: false)', false)
	.option('-s, --scaffold [type]', 'create a template source (input) directory (default: false)', false)
	.option('-r, --redirect [type]', 'create a page in the parent directory that redirects to the homepage (default: false)', false)
	.option('-v, --verbose [type]', 'verbose output, including detailed errors (default: false)', false)
	//.option('-t, --pagetoc [type]', 'include a page table of contents (default: true)', true)
	.parse(process.argv);

generator.setOptions(options);
if (options.scaffold === false) {
	generator.run();
} else {
	generator.scaffold();
}



