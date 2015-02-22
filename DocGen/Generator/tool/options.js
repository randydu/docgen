var program = require('commander');

module.exports = function Options()
{
	this.load = function () {
		program
		  .version('2.0.0')
		  .option('-i, --input [type]', 'path to input directory (default: pwd)', 'pwd')
		  .option('-o, --output [type]', 'path to output directory (default: ./outputs)', './output')
		  .option('-H, --homepage [type]', 'set the homepage filename (default: index.html)', 'index.html')
		  .option('-p, --pagetoc [type]', 'include a page table of contents (default: true)', true)
		  .option('-w, --warnings [type]', 'suppress internet explorer warnings (default: false)', false)
		  .parse(process.argv);

		console.log(program.input);
		console.log(program.output);
		console.log(program.homepage);
		console.log(program.pagetoc);
	    console.log(program.warnings);
	}
}
