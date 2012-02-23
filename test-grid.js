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

test('test');
// simply write then read a binary file to mongo
function test(dbname){
  console.log("Grid Test database: %s",dbname);
  var mongoURL="mongodb://localhost/"+dbname+"?auto_reconnect=true";
  mongodb.connect(mongoURL, function(err, db){
    if(checkError(err)) {
      proces.exit();
      return;
    }
    var g = new mongodb.Grid(db,"fs");
    var id='hello';
    //var id=new mongodb.ObjectID("4f45179af42bdd4512000001");
    var data = new Buffer("abcde");
    var data = new Buffer([0,1,2,3,252,253,254,255]);
    g.put(data,{NOTfilename:id,metadata:{mime:'image/mine'}},function(err,result){
      console.log('err',err);
      console.log('result',result);
      g.get(result._id,function(err,readData){
        console.log('get:err',err);
        console.log('read back',readData);
        if (0)g.delete(result._id,function(err,deleteResult){
          console.log('get:err',err);
          console.log('delete',deleteResult);
          db.close();
        });
        else db.close();
        
      });
    });
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


