/*
npm install mongodb
npm install traverse
npm install async
*/
var path=require('path');
var fs=require('fs');
var mongodb = require('mongodb');
var async = require('async');
var traverse = require('traverse');


function dump(dbname,gitdir){
  console.log("Dumping database: %s to %s",dbname,gitdir);
  var mongoURL="mongodb://localhost/"+dbname+"?auto_reconnect=true";
  mongodb.connect(mongoURL, function(err, db){
    if(checkError(err)) {
      proces.exit();
      return;
    }
    doFiles(db);
    var basename = path.join(gitdir,dbname);  
    if(0)eachCollection(db,basename,function(){
      console.log('db:',dbname,'done');
      db.close();
    });
  });
}

function doFiles(db){
//  var gridStore = new mongodb.GridStore(db, "foobar", "w");
  var opts={id:true};
  mongodb.GridStore.list(db, "fs", opts, function(err,fileIds){
    //fileIds = [new mongodb.ObjectId('4f17171cdfaf88d45e00004d')];
    fileIds = [new mongodb.ObjectID('4f17171cdfaf88d45e00004d')];
    console.log('file Ids:',fileIds);
    async.forEachSeries(fileIds,function(id,next){
      
      console.log('fetching: ',id,id._bsontype);
      var g = new mongodb.Grid(db,"fs");
      g.get(id,function(err,data){
        console.log('got data:',typeof data,data.length);
        // fs.writeSync(fd, buffer, offset, length, position);
        mkdirp('files');
        fs.writeFileSync('files/'+id+'.png',data);
        next();
      });      
    },function(err){
      console.log('done');
      process.exit();
    });    
  });
}
function eachCollection(db,basename,cb){
  console.log('db:',dbname);
  db.collections(function(err, collections) {
    if ( checkError(err,cb) ) return;
    console.log('|collections|:',collections.length);
    async.forEachSeries(collections,function(collection,next){
      console.log('  coll:',collection.collectionName);
      if (collection.collectionName=='fs.chunks'){next();return;}
      var backupDir = path.join(basename,collection.collectionName);
      mkdirp(backupDir);    
      eachDoc(collection,backupDir,function(err){
        console.log('  coll:',collection.collectionName,'done');
        next(err); 
      });
    },cb);      
  });
}

function eachDoc(collection,backupDir,cb){
  collection.find(function(err, cursor) {
    if(checkError(err,cb)) return;
    cursor.toArray(function(err, docs) {          
      if(checkError(err,cb)) return;
      console.log('    |coll(',collection.collectionName,')|:',docs.length);
      rewriteMongoOut(docs);
      async.forEachSeries(docs,function(doc,next){
        saveDoc(doc,backupDir,true,next);
      },cb);
    });
  });
}

function saveDoc(doc,backupDir,pretty,cb) {
  var id = doc._id;
  var fname;
  if (!id) {
    id = doc.ns;
    fname=id;
  } else {
    fname = id.substr(3);
  }
  fname = fname + ".json";    

  fullfname = path.join(backupDir,fname);
  var json = pretty?JSON.stringify(doc,null,2):JSON.stringify(doc);
  fs.writeFileSync(fullfname,json);
  cb(null);
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

function checkError(error,cb){
  if (error) {
    console.error(error.message);
    if (cb) cb(error);
    return true;
  }
  return false;
}

if (process.argv.length<4){
    console.error('usage: node dump.js <dbname> <gitdir>')
    process.exit();
}
var dbname = process.argv[2];
var gitdir = process.argv[3];
dump(dbname,gitdir);

