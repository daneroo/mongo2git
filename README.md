# mongo2git = Mongudump to git
Idea: progressively commit database snapshots through a mongo dump to a git repo

# node.js version

### Install notes node.js version

    npm install

### Pull Dailys

    node s3-fetch.js

## Install notes - ruby version
Dependancy for `s3-fetchAllDailys.rb`

    sudo gem i aws-s3

Get mongoo for php : move this to osx_mongo_install repo...

    # sudo pecl install mongo
    This is F&^@%# Broken on Lion: God damn it.
    
    # Just copy it from dirac!
    cd /usr/lib/php/extensions/no-debug-non-zts-20090626
    scp -p dirac:/usr/lib/php/extensions/no-debug-non-zts-20090626/mongo.so .

    sudo vi /etc/php.ini
    # add this /etc/php.ini
    extension=mongo.so
    # verify extension os ok
    php --re mongo
    
    
 check out php's Console_Getopt

# Parts
Execute in php and node
* dump
* verify
* restore
## Size problem ?
It turns out that mongo-php'implementation of GridFS does not have a standard representation.
The normal represeantaiotn of chunked GrtidFS files looks like this

    fs.files: [
        {_id:xx0, length:len0, ...}
        {_id:xx1, length:len1, ...}
    ]
    fs.chunks: [
        {id:yy1 files_id:xx0, n:0, data:BinData(2,<Base4Str>)}
        {id:yy2 files_id:xx0, n:1, data:BinData(2,<Base4Str>)}
        {id:yy3 files_id:xx1, n:0, data:BinData(2,<Base4Str>)}
        {id:yy4 files_id:xx1, n:1, data:BinData(2,<Base4Str>)}
    ]
    
The problem lies in the fact that the chunks.data members are all prefixed with 4 bytes, in the php,
which all seem to have the fs.file.length encoded as a prefix to the data. we can detect this becaus the length
reported in fs.files does not match the sum of lengths of the associated chunks.
Here is a mongo shell script snippet which reports the problem.

    db.fs.files.find({}).forEach(function(f){
      var _id=f._id;
      var fileSize=db.fs.files.findOne({_id:_id}).length;
      var chunkSizeSum=0;
      var chunkCount=0;
      db.fs.chunks.find({files_id:_id}).forEach(function(c){
        var chunkSize=c.data.length();
        chunkSizeSum+=chunkSize;
        chunkCount++;
      });
      if (fileSize==chunkSizeSum) {
          printjson([_id.toString(),'chunks are ok']);
      } else if (chunkSizeSum==(fileSize+chunkCount*4)) {
          // php's bad representation
          printjson([_id.toString(),'chunks in php-mongo format']);
      } else {
          printjson([_id.toString(),'chunks unknown format',fileSize,chunkSizeSum,chunkCount,fileSize-chunkSizeSum]);
      }
    });

    // THIS DOES NOT WORK: we want to trim 4 byte of the data, not 4 bytes of the base64 (that trims only 3 bytes.)
    // Don't know how to get the bin data in the mongoshell
    // trim 4 byte prefix!
    db.fs.chunks.find().forEach(function(c){
      var chunkSize=c.data.length();
      var prefix = c.data.base64().substr(0,4);
      var prefixBin = new BinData(2,prefix);
      var prefixHex = prefixBin.hex();
      var trimed = c.data.base64().substr(4);
      var trimedBin = new BinData(2,trimed);
      //printjson([chunkSize,c.data.base64(),prefix,prefix.length,prefixHex,trimed.length]);
      printjson([chunkSize,'=',prefixBin.length(),'+',trimedBin.length(),prefixHex]);

      c.data=trimedBin;
      db.fs.chunks.save(c)

    });


## Restore loop
To fetch:

    cd ~/Documents/Code/Ekomobi/migration/s3restore/
    ruby s3restoreAllDailys.rb
    rsync -n -av --progress mongo-ekomobi_prod-* /Users/daniel/Downloads/Ekomobi_AllBackups
    

To get started from a set of mongudump snapshots.

    fetch all dailys
    expand named archive of mongodump
    mongorestore to create dbpath
    start mongo on that path
    iterate to dump data into files
    git commit    

# Parts
## S3 credentials for  jgit

create a setting file for [jgit](http://www.eclipse.org/jgit/download/), as described in [this article](http://ravionrails.blogspot.com/2011/08/manage-git-repos-on-s3.html),
and also in [this older but more detailed article](http://blog.spearce.org/2008/07/using-jgit-to-publish-on-amazon-s3.html)

    touch ~/.jgit_s3
    chmod 600 ~/.jgit_s3

With the following content

    accesskey: AWSAccessKeyId
    secretkey: AWSSecretAccessKey
    acl: public

Now create an S3 bucket __ax-git-repos__ for use with those credentials.

    git remote add s3 amazon-s3://.jgit_s3@ax-git-repos/test.git

    ../jgit.sh push s3 refs/heads/master
    # or 
    git config --add remote.s3.push refs/heads/master
    ../jgit.sh push s3
  

# Resotre a mongo

rm -rf restore/ekomobi_bak;
mkdir -p restore/ekomobi_bak;
(cd restore/ekomobi_bak; tar xzvf ../../mongo-ekomobi_prod-20120121-0000-i-62203a02.tgz)

rm -rf data
mkdir data
mongorestore --dbpath data --db ekomobi_bak restore/ekomobi_bak

# cleanup
rm -rf restore;
rm -rf data;
    
    
## Node
Using node mongodb to extract all files and objects
Perhaps using node gitteh to commit to repo and push to S3. (using jgit)

## Serving git over apache http

    # GIT Config
    SetEnv GIT_PROJECT_ROOT /opt/git/repositories
    SetEnv GIT_HTTP_EXPORT_ALL
    
    # Route Git-Http-Backend
    ScriptAlias /git/ /usr/lib/git-core/git-http-backend/    

