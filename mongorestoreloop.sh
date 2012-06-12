#!/bin/sh

# this is a shell array
#MONGODUMPS=(~/Downloads/Ekomobi_Dailys/mongo-*.tgz)
MONGODUMPS=(~/Downloads/Ekomobi_Dailys/mongo-*-201202*.tgz)
# MONGODUMPS=(~/Downloads/Ekomobi_Dailys/mongo-*-20120225*.tgz)

RESTOREPATH=restore
DATAPATH=data
GITDIR=git-mongo
DBNAME=ekomobi_bak

function log(){
  echo "-----" ${SECONDS} -- `date "+%Y-%m-%dT%H:%M:%S"` $* "-----"
}

function startMongo(){
  log Start mongo
  rm -rf ${DATAPATH}
  mkdir ${DATAPATH}
  mongod --dbpath data --quiet --logpath /dev/null >/dev/null 2>&1 &
  sleep 2;
}

function stopMongo(){
  log Stop mongo
  echo "db.shutdownServer();" | mongo admin >/dev/null
  #rm -rf ${DATAPATH}
}

function gitInit(){
  log Git init
  rm -rf ${GITDIR}
  mkdir -p ${GITDIR}
  (cd ${GITDIR}; git init --quiet);
}

function restoredump(){
    local DUMPARCHIVE=$1
    log Restoring $DUMPARCHIVE

    rm -rf ${RESTOREPATH};
    mkdir -p ${RESTOREPATH};
    (cd ${RESTOREPATH}; tar xzf ${DUMPARCHIVE}) >/dev/null

    echo "db.dropDatabase()"|mongo ${DBNAME} >/dev/null
    log "Dropped DB ${DBNAME}"
    mongorestore --drop --db ${DBNAME} restore >/dev/null 2>&1
    log "Restored DB ${DBNAME}"

    # fix chunks before of or after php..
    node fixchunks.js ${DBNAME} ${GITDIR}
    node fixchunks.js ${DBNAME} ${GITDIR}
    log "Fixed chunks"
    
    # php dump.php ${DBNAME} ${GITDIR}
    # log "Dumped (php)"

    node dump.js ${DBNAME} ${GITDIR}
    log "Dumped (node)"

    #cleanup
    rm -rf ${RESTOREPATH};
}

log Mongo Restore loop

gitInit
startMongo

for d in ${MONGODUMPS[@]}; do
    rm -rf ${GITDIR}/${DBNAME};
    
    restoredump $d 

    (cd ${GITDIR}; git add -u .; git add .; git commit -q -m `basename $d .tgz`);
    log Commited to Git
    
done

stopMongo
