var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var async = require('async');

var awssum = require('awssum');
var amazon = awssum.load('amazon/amazon');
var S3 = awssum.load('amazon/s3').S3;

var settingsFileName = 's3-settings.json';
var settings = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, settingsFileName), 'utf8'));

// console.log('credentials',settings.credentials);
console.log('endpoint', settings.endpoint);

var s3 = new S3({
  accessKeyId: settings.credentials.mongoreader.accessKeyId,
  secretAccessKey: settings.credentials.mongoreader.secretAccessKey,
  'region': amazon.US_EAST_1
});

// console.log('Region :', s3.region());
// console.log('EndPoint :', s3.host());
// console.log('AccessKeyId :', s3.accessKeyId());
// console.log( 'SecretAccessKey :', s3.secretAccessKey() );
// console.log('AwsAccountId :', s3.awsAccountId());
if (0) s3.ListBuckets(function (err, data) {
  console.log("List buckets", err, data);
});

var fetchOptions = {
  MaxKeys: 200,
  Prefix: 'mongo-ekomobi_prod-201206',
  BucketName: settings.endpoint.bucket
};

getAll(fetchOptions, function (err, results) {
  function isDaily(f){
    // match parts : *,db,date,hour,amazonId
    var re=/^mongo-(.*)-([0-9]{8})-([0-9]{4})-(.*).tgz/;
    var found = f.Key.match(re);
    console.log('match',found,found[2]);
    return found && found[3]==='0000';
  }
  results = results.filter(isDaily);
  results.reverse();
  
  if (err) {
    console.log('Error', JSON.stringify(err, null, 2));
    return;
  }
  console.log('done reading ', results.length, 'objects');

  function iterator(f, next) {
    showFileObject(f);
    // next();
    if (1) {
      checkOne(f, function (err, ok) {
        if (err) {
          console.log('Error', JSON.stringify(err, null, 2));
          next(err);
        } else {
          console.log('ok', ok);
          next();
        }
      });
    }
  }
  async.forEachSeries(results, iterator, function (err) {
    console.log('done checking');
  });
  // series results.forEach(checkOne);
});


// Helper functions below

function showFileObject(f) {
  console.log(f.Key, f.Size, f.LastModified, f.ETag);
}

function checkOne(f, cb) {
  // console.log('checkOne',f);
  oETag = JSON.parse(f.ETag); // remove the extra ""
  var fileName = path.join(settings.snapshotDir, f.Key);
  console.log('checking file', fileName, '==', oETag);

  if (path.existsSync(fileName)){
    var md5sum = crypto.createHash('md5');
    var s = fs.ReadStream(fileName);
    s.on('data', function (d) {
      md5sum.update(d);
    });

    s.on('end', function () {
      var d = md5sum.digest('hex');
      console.log(d + '  ' + fileName);
      if (d === oETag) {
        console.log('  ++ETag==md5: skipping');
        cb(null, 'OK');
      } else {
        console.log('  ++must download');
        cb({
          message: 'must download ' + fileName
        });
      }
    });
    s.on('error', function (exception) {
      console.log('exception',exception);
      cb({
        message: 'error reading ' + fileName
      });
    });
  } else {
    console.log('file does not exist',fileName);
    fetchOne(f,cb);
    if(0)cb({
      message: 'file not found ' + fileName
    });
  }
}

function fetchOne(f, cb) {
  console.log('fetchOne fetching', f);
  var fileName = path.join(settings.snapshotDir, f.Key);

  var options = {
    BucketName: settings.endpoint.bucket,
    ObjectName: f.Key
  };

  s3.GetObject(options, function (err, data) {
    if (err) {
      console.log('Error', JSON.stringify(err, null, 2));
      cb(err);
      return;
    }
    console.log('Data', data);
    var md5=crypto.createHash('md5').update(data.Body).digest("hex");
    console.log('fetched file:%s length:%d md5:%s',fileName,data.Body.length,md5);
    fs.writeFileSync(fileName,data.Body);
    if (cb) cb(null,'OK');
  });
}

function md5File(fileName) {

}
// this function writes over options (adds Marker on iteration)

function getAll(options, cb) { // cb(err,array)
  var results = [];

  function part(cb) {
    console.log('part', options)
    s3.ListObjects(options, function (err, data) {
      if (err) cb(err);
      if (!data || !data.Body || !data.Body.ListBucketResult) {
        cb({
          message: 'Bad ListBucketResult',
          data: data
        });
      } else {
        var lbr = data.Body.ListBucketResult;
        if (lbr.Contents) { // undefined for no objects
          results = results.concat(lbr.Contents);
        }
        console.log('results now has', results.length, 'elements');
        if (lbr.IsTruncated === 'true') {
          options.Marker = lbr.Contents[lbr.Contents.length - 1].Key;
          part(cb);
        } else {
          if (cb) cb(null, results);
        }
      }
    });
  }
  part(cb);
}
