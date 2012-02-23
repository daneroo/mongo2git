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


function fix(dbname){
  console.log("Fixing database: chunks for %s.fs",dbname);
  var mongoURL="mongodb://localhost/"+dbname+"?auto_reconnect=true";
  mongodb.connect(mongoURL, function(err, db){
    if(checkError(err)) {
      process.exit();
      return;
    }
    findFiles('fs',db,function(err){
      console.log('Fixing done');
      if (err) console.log('  err:',err);
      db.close(); 
    });
  });
}

function findFiles(gridroot,db,cb){
  db.collection(gridroot+'.files',function(err,collection){
    collection.find(function(err, cursor) {
      if(checkError(err,cb)) return;
      // just get _id and length
      collection.find({},{length:true},function(err, cursor) {
        if(checkError(err,cb)) return;
        //cursor.each(function(err, file) {
        cursor.toArray(function(err, files) {
          if(checkError(err,cb)) return;
          async.forEachSeries(files,function(file,next){
            findChunks(gridroot,file._id,file.length,db,next);
          },cb);
        });
      });
    });
  });
}

function findChunks(gridroot,files_id,fileSize,db,cb){
  db.collection(gridroot+'.chunks',function(err,collection){
    collection.find({files_id:files_id},function(err, cursor) {
      if(checkError(err,cb)) return;
      cursor.toArray(function(err, chunks) {
        if(checkError(err,cb)) return;
        var chunkCount=chunks.length;
        var chunkSizeSum=0;
        //console.log('      file:%s chunk count: %d',files_id,chunks.length);
        async.forEachSeries(chunks,function(chunk,next){
          chunkSizeSum+=chunk.data.buffer.length;
          // console.log('  -chunk length',chunk.data.length());
          //console.log('  found file:%s chunk:%d size:%d (%s)',chunk.files_id,chunk.n,chunk.data.buffer.length,chunk._id);
          next();
        },function(err){
          if (fileSize==chunkSizeSum) {
            // console.log('file:%s chunk format is ok',files_id);
          } else if (chunkSizeSum==(fileSize+chunkCount*4)) {
            console.log('file:%s chunks in php-mongo format',files_id);
            fixChunks(chunks,collection,cb);
            return; // so fixChunks will call the cb
          } else {
            console.log('%s chunks in unknown format fileSize:%d sum(n:%d chunks):%d',files_id,fileSize,chunkCount,chunkSizeSum);
          }
          cb();
        });
      });
    });
  });
}

function fixChunks(chunks,chunkCollection,cb){
  // console.log('  -fixing %d chunks',chunks.length);
  async.forEachSeries(chunks,function(chunk,next){
    // console.log('  -chunk length',chunk.data.length());
    var prefixInt = chunk.data.buffer.slice(0,4).readUInt32LE(0);    
    var trimmed = chunk.data.buffer.slice(4);
    chunk.data = new mongodb.Binary(trimmed,2);
    var prefixOK=(chunk.data.length()==prefixInt)?'ok':'not ok';
    if (!prefixOK){
      console.log('  +chunk length %d == %d %s',chunk.data.length(),prefixInt,prefixOK);
    }
    chunkCollection.save(chunk,{safe:true},function(err){
      if (err){
        console.error('There was an error saving chunk %s',chunk._id);
      } else {
        // console.error('Saved files:%s  chunk:%s',chunk.files_id,chunk._id);
      }
      next();      
    })
  },function(err){
    console.log('  fixed %d chunks',chunks.length);
    if(cb) cb();
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

if (process.argv.length<3){
    console.error('usage: node %s %s <dbname>',process.argv[0],process.argv[1])
    process.exit();
}
var dbname = process.argv[2];
fix(dbname);

