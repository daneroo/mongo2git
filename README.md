# mongo2git = Mongudump to git
Idea: progressively commit changes in a mongo dump to a git repo


## Restore loop
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

