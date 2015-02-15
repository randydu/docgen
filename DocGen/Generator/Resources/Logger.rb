# (c) 2015 Mark Macdonald

require 'rbconfig'
require 'rubygems'
require 'systemu'

class Logger
   def initialize()
	  if File.exists?("log.txt") 
	    File.delete("log.txt")
	  end
      @f = File.new("log.txt", "w+")
	  @time = Time.new
	end

	def log_environment(version)
	begin
	  @f.puts "One-shot log for DocGen"
	  @f.puts "***************************", ""
	  
	  @f.print "Execution: ", "[ ", @time.day, "-", @time.month,  "-", @time.year, " ", @time.hour, ":", @time.min,  ":", @time.sec, " ]\n"
	  @f.print "Arguments: ", $* , "\n\n"
	  
	  @f.print "DocGen Version: ", version ,"\n"
	  @f.print "Ruby Platform: ", RUBY_VERSION , " ", RUBY_RELEASE_DATE, " ", RUBY_PLATFORM, "\n"
	  @f.print "Ruby Configuration: ", RbConfig::CONFIG["configure_args"].to_s, "\n"
	  @f.print "Ruby Path: ", RbConfig::CONFIG['bindir'].to_s, "\n\n"
	  
	  #print all Ruby gems and their versions
	  # name = /^/i
	  # dep = Gem::Dependency.new(name, Gem::Requirement.default)
	  # gems = Gem.source_index.search(dep)
	  #@f.puts "Installed Ruby Gems:"
	  #@f.puts gems.map{ |s| "#{s.name} #{s.version}" }
	  #@f.print "\n"

	  arg = "gem query --local"
	  status, stdout, stderr = systemu arg
	  result = status.to_s.split(" ").last
	   if(result != "0")
	     Log.log_message("Failed to call gem command",true)
	     Log.log_message(stderr,true)
	   else 
	     @f.puts [stdout,stderr]
	   end
	  
	  @f.puts "Ruby Load Path:"
	  @f.puts $LOAD_PATH,""

	  #print the gem enviroment details
	  arg = 'gem env'
	  status, stdout, stderr = systemu arg
      result = status.to_s.split(" ").last
	   if(result != "0")
	     Log.log_message("Failed to call gem command",true)
	     Log.log_message(stderr,true)
	   else 
	     @f.puts [stdout,stderr]
	   end

	  @f.puts "System Environment:"
	  ENV.each do |item|
	   @f.puts item
	  end

	  @f.puts "","Runtime Log:",""
	 
	  rescue Exception => e
	   Log.log_message("Exception while logging the environment (non-critical) ",true)
	   log_exception()
      end
	end

	def log_PDF_engine_environment
	  @f.puts "     **************************************************"
	  @f.print "     PDF Engine:", OutputPDF.PDF_engine_version,"\n"
	  @f.puts "     **************************************************"
	end
	
	def log_message(message,silent)
	  if(!silent) 
	    print message,"\n"
	  end
	  @f.print "[ ", @time.day, "-", @time.month,  "-", @time.year, " ", @time.hour, ":", @time.min,  ":", @time.sec, " ]   "
	  @f.puts message
	end
	
	def log_exception()
	  @f.print "[ ", @time.day, "-", @time.month,  "-", @time.year, " ", @time.hour, ":", @time.min,  ":", @time.sec, " ]   "
	  @f.puts $! #the last exception
	  @f.puts "\tLocation:\n\t#{$@.join("\n\t")}" #pretty print the stack backtrace
	end

end
