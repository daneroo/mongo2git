/*
npm install mongodb
npm install traverse
*/
var path=require('path');
var fs=require('fs');
var mongodb = require('mongodb');
var traverse = require('traverse');

function dump(dbname,gitdir){
  console.log("Dumping database: %s to %s",dbname,gitdir);
  var collections=['sites','users','archives','system.indexes','fs.files'];
  // var collections=['sites','users'];
  var popAndSave=function(err,selfcb){
    if (collections.length<=0) {
      console.log('totaly done');
      process.exit();
      return;
    }

    var collectionName = collections.shift();
    console.log('doing collection %s',collectionName);
    var backupDir = path.join(gitdir,dbname,collectionName);
    mkdirp(backupDir);
    saveAll(dbname,collectionName,backupDir,selfcb);        
  }
  popAndSave(null,popAndSave);
}

function checkError(error,cb){
  if (error) {
    console.error(error.message);
    if (cb) cb(error);
    return true;
  }
  return false;
}

function saveAll(dbname,collectionName,backupDir,cb) {
  var mongoURL="mongodb://localhost/"+dbname+"?auto_reconnect=true";

  mongodb.connect(mongoURL, function(err, conn){
    if(checkError(err)) {if(cb)cb(err);return;}
    conn.collection(collectionName, function(err, coll){
      if(checkError(err)) {if(cb)cb(err);return;}
      // You can turn it into an array
      coll.find({},{},function(err, cursor) {
        if(checkError(err)) {if(cb)cb(err);return;}
        cursor.toArray(function(err, docs) {          
          if(checkError(err)) {if(cb)cb(err);return;}
          console.log(collectionName+".count: " + docs.length);
          rewriteMongoOut(docs);
          docs.forEach(function(doc){
            // console.log('doc',doc._id/*JSON.stringify(doc)*/);
            saveOne(doc, backupDir,true);
          });
          if(cb) cb(null,cb);
        });
      });
    });
  });
}

function saveOne(doc, backupDir,pretty) {
    var id = doc._id;
    if (!id) {
        id = doc.ns;
    }
    var fname = id.substr(3) + ".json";
    
    fullfname = path.join(backupDir,fname);
    // console.log("    saving object as %s (pretty %s)",fullfname,pretty);
    var fd = fs.openSync(fullfname, 'w' /*,0666*/);
    var json = pretty?JSON.stringify(doc,null,2):JSON.stringify(doc);
    fs.writeSync(fd, json /*, position, [encoding='utf8']*/);
    fs.closeSync(fd);
}

// replaces MongoId classes for "ID:<hexId>" string
function rewriteMongoOut(obj) {
  traverse(obj).forEach(function (x) {
    // console.log('traverse: %d %s',this.level,this.path, typeof x)
    if (x && x._bsontype){
      if (x._bsontype=='ObjectID'){
        this.update('ID:'+x.toString(),true);
      } else {
        console.log('unsupported bsontype:%d %s : ',this.level,this.path,x._bsontype)
      }
    }
  });
}

function mkdirp(dirname){
    // coco/caca/kiki -> ['coco','caca','kiki'];
    var child=dirname;
    var paths = [child];
    while (true){
        var parent=path.dirname(child);
        if (parent==child) break;
        paths.unshift(parent);
        child=parent;
    }
    paths.forEach(function(part){
        if (!path.existsSync(part)){
            fs.mkdirSync(part, 0777);
        }
    });
}

if (process.argv.length<4){
    console.error('usage: node dump.js <dbname> <gitdir>')
    process.exit();
}
var dbname = process.argv[2];
var gitdir = process.argv[3];

dump(dbname,gitdir);

