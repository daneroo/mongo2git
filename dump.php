<?php

function backupDir($baseDir,$dbName,$collectionName,$create = true) {
    $path = array(
        $baseDir,
        $dbName,
        $collectionName
    );
    $dirname = implode(DIRECTORY_SEPARATOR, $path);
    // echo "INFO: check $dirname : $create\n";
    if ($create) {
        if (!file_exists($dirname)) {
            mkdir($dirname, 0777, true); //recursive write by all
        }
    }
    return $dirname;
}

// replaces MongoId classes for "ID:<hexId>" string
function rewriteMongoOut(&$any) {
    if (is_array($any)) { // or is_object?
        foreach ($any as $key => $value) {
            $any[$key] = rewriteMongoOut($value);
        }
    } else if (is_object($any) && "MongoId" == get_class($any)) {
        $idStr = "ID:" . $any;
        return $idStr;
    }
    return $any;
}

function saveOne($object, $backupDir,$pretty) {
    $_id = $object["_id"];
    if (!$_id) {
        $_id = $object["ns"];
    }
    $fname = substr($_id, 3) . ".json";
    $fullfname = implode(DIRECTORY_SEPARATOR, array($backupDir, $fname));
    // echo "    saving object as $fullfname (pretty $pretty)\n";
    flush();
    if ($pretty){
        $tmpfile='tmp.json';
        $fp = fopen($tmpfile, 'w');
        fwrite($fp, json_encode($object));
        fclose($fp);
        shell_exec("cat $tmpfile | python -mjson.tool >$fullfname");
        unlink($tmpfile);
    } else {
        $fp = fopen($fullfname, 'w');
        fwrite($fp, json_encode($object));
        fclose($fp);
    }
}

function saveAll($dbname,$collectionName,$backupDir) {
    $m = new Mongo("mongodb://localhost/", array("persist" => "onlyone"));
    $db = $m->selectDB($dbname);
    $collection = $db->selectCollection($collectionName);
    $query=array();
    $fields=array();
    $cursor = $collection->find($query, $fields);
    $docs = array_values(iterator_to_array($cursor));
    rewriteMongoOut($docs);
    
    echo "$collectionName has ". $cursor->count()." entries. saving to $backupDir\n";
    foreach ($docs as $doc) {
        #echo "saving object ".$doc['_id']."\n";
        saveOne($doc, $backupDir,false);
    }
}

function saveFiles(){
    if (1){
        $dbname='ekomobi_bak';
        $m = new Mongo("mongodb://localhost/", array("persist" => "onlyone"));
        $db = $m->selectDB($dbname);

        $files = $db->selectCollection('fs.files');
        $cursor = $files->find();
        foreach ($cursor as $file) {
            $strid = "".$file['_id'];
            // echo "Getting _id:".$strid."\n";
            saveFile("".$strid);        
        }
    } else {
        $fileIds=array('4f17171cdfaf88d45e00004d','4e5d5724c9519c9d59000001');
        // $fileIds=array('4f17171cdfaf88d45e00004d');
        foreach ($fileIds as $strid){
            saveFile($strid);
        }
    }

}
function saveFile($strid){
    $dbname='ekomobi_bak';
    $m = new Mongo("mongodb://localhost/", array("persist" => "onlyone"));
    $db = $m->selectDB($dbname);
    $grid = $db->getGridFS();
    
    $strid = str_replace('ID:', '', $strid);
    $id=new MongoId($strid);
        
    // $file = $grid->get($id);
    $file = $grid->findOne(array('_id'=>$id));

    if ($file == null){
        return;
    }

    
    $data=$file->getBytes();

    $ascii='';
    for ($i=0;$i<10;$i++) $ascii=$ascii.'.'.dechex(ord($data[$i]));
    error_log('-dump.php data.len: '.strlen($data));
    error_log('   raw: '.substr($data,0,10).'...'.substr($data,-10));
    error_log('   hex: '.$ascii);

    $tmpfile='files/'.$id.'-e64-php.png';// = 
    $fp = fopen($tmpfile, 'w');
    fwrite($fp, $data);
    fclose($fp);

    // unencode base64
    $data = base64_decode($data);

    $tmpfile='files/'.$id.'-d64-php.png';// = str_replace('ID:', '', $strid).'.png';
    $fp = fopen($tmpfile, 'w');
    fwrite($fp, $data);
    fclose($fp);

    $type = exif_imagetype($tmpfile);
    $mimetype = image_type_to_mime_type($type);
    error_log('+dump.php data.len: '.strlen($data).' type: '.$mimetype);


}
$dbname = $argv[1];
$gitdir = $argv[2];
if ($dbname && $gitdir){
    echo "Saving One Image\n";
    saveFiles();
    exit();
    echo "Dumping database: $dbname to $gitdir\n";
    $collections=array('sites','users','archives','system.indexes','fs.files');
    foreach ($collections as $collectionName) {
        $backupDir = backupDir($gitdir,$dbname,$collectionName,true);
        saveAll($dbname,$collectionName,$backupDir);
    }

} else {
    echo "Usage php dump.php <dbname>\n";
}
?>