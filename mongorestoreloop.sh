#!/bin/sh

# this is a shell array
MONGODUMPS=(~/Downloads/Ekomobi_AllBackups/mongo-*.tgz)
# MONGODUMPS=(~/Downloads/Ekomobi_AllBackups/mongo-*-20120121*.tgz)
MONGODUMPS=(~/Downloads/Ekomobi_AllBackups/mongo-*-20120217*.tgz)
RESTOREPATH=restore
DATAPATH=data
GITDIR=git-mongo
DBNAME=ekomobi_bak

function restoredump(){
    local DUMPARCHIVE=$1
    echo restoring $DUMPARCHIVE
    rm -rf ${RESTOREPATH};
    mkdir -p ${RESTOREPATH};
    (cd ${RESTOREPATH}; tar xzf ${DUMPARCHIVE}) >/dev/null

    # rm -rf ${DATAPATH}
    # mkdir ${DATAPATH}
    # mongorestore --dbpath ${DATAPATH} --db ekomobi_bak restore >/dev/null
    time echo "db.dropDatabase()"|mongo ${DBNAME} >/dev/null
    echo "END drop ------"
    time mongorestore --drop --db ${DBNAME} restore >/dev/null
    echo "END restore ------"

    # echo Sizes `du -sm ${RESTOREPATH} ${DATAPATH}`

    # time php dump.php ${DBNAME} ${GITDIR}
    # echo "END PHP  ------"
    time node dump.js ${DBNAME} ${GITDIR}
    echo "END node ------"

    #cleanup
    rm -rf ${RESTOREPATH};
    # rm -rf ${DATAPATH}
}

echo Mongo Restore loop

echo Git init
rm -rf ${GITDIR}
mkdir -p ${GITDIR}
(cd ${GITDIR}; git init);

echo Start mongo
rm -rf ${DATAPATH}
mkdir ${DATAPATH}
mongod --dbpath data --quiet --logpath /dev/null &
sleep 3;

for d in ${MONGODUMPS[@]}; do
    # echo $d;
    rm -rf ${GITDIR}/${DBNAME};
    # (cd ${GITDIR}; git status)
    restoredump $d
    time (cd ${GITDIR}; git add -u .; git add .; git status; git commit -q -m `basename $d .tgz`);
    echo "END commit ------"
    
done

echo "Stop mongo"
echo "db.shutdownServer();" | mongo admin >/dev/null
rm -rf ${DATAPATH}
