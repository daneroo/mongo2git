#!/usr/bin/env ruby

%w(rubygems aws/s3 fileutils).each do |lib|
  require lib
end
include AWS::S3

# =-=- START OF SETTINGS
# use SSL to transmit backups to S3 (a good idea)
USE_SSL = true

# mongoreader credentials
# CREATE AWS/S3 CONNECTION
require 's3-credentials-settings'

# =-=- END OF SETTINGS

puts "Fetching daily snapshots from s3:#{S3_BUCKET}/#{DB_NAME} to #{SNAPSHOTS_DIR}"

if !File.directory? SNAPSHOTS_DIR
  puts "Snapshot directory not found: #{SNAPSHOTS_DIR}"
  exit
end

# Find the backup bucket
if Service.buckets.collect{ |b| b.name }.include?(S3_BUCKET)
  bucket = Bucket.find(S3_BUCKET)
  puts "Found bucket: #{S3_BUCKET}"
else
  begin
    puts "Could not find the bucket: #{S3_BUCKET}"
    Process.exit(false)
  end
end

puts "Bucket #{S3_BUCKET} has #{bucket.count} objects (total)"

# classify objects by DB as parsed in our naming convention
# mongo-ekomobi_prod-20120214-0000-i-62203a02.tgz
# mongo-<DBNAME>-<YYYYMMMDD-HHMM>-<originId>.tgz
# origin Id is usualy the amazon instanceId
objectsByDB=bucket.group_by {|f| 
  re=/\Amongo-(.*)-[0-9]{8}-[0-9]{4}-(.*).tgz\z/
  m = re.match(f.key)
  # m[2] has the instance id
  #puts("f:#{f.key} i:#{m[2]}")
  (m)?m[1]:'unknown'
}

objectsByDB.each do |dbname,snapshots|
  puts "  -- #{snapshots.count} objects for #{dbname}"
end

selectedDB = objectsByDB[DB_NAME]
puts "\nBucket #{S3_BUCKET} has #{selectedDB.count} objects for #{DB_NAME}"
selectedDB[0..1].each do |f|
  puts "  -#{f.key} : #{f.size} bytes, modified: #{f.last_modified}  etag:#{f.etag}"
end
puts "  ..."
selectedDB[-2..-1].each do |f|
  puts "  +#{f.key} : #{f.size} bytes, modified: #{f.last_modified}  etag:#{f.etag}"
end

puts "--now fetch some backups"

selectedDB.to_a.reverse.each do |f|
  next unless f.key.include? "-0000-" # just download dailys
  fname = File.join(SNAPSHOTS_DIR, f.key)
  # puts "  -consider #{f.key} : #{f.size} bytes, modified: #{f.last_modified}  etag:#{f.etag}"
  md5 = 'notfound'
  md5 = Digest::MD5.file(fname) if File.exists?(fname)

  #next if md5==f.etag
  if md5==f.etag
    puts "  -skipping #{f.key} : #{f.size} bytes, modified: #{f.last_modified}  etag:#{f.etag}==md5:#{md5}"
    next
  end
  
  puts "  -fetching #{f.key} : #{f.size} bytes, modified: #{f.last_modified}  etag:#{f.etag}"
  open(fname, 'w') do |file|
    file.write f.value
  end
  md5 = Digest::MD5.file(fname)
  puts "  -done     #{f.key} : md5:#{md5}"
  
end
