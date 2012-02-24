<?php

main(&$argv);

function main($argv) {
    $dbname = $argv[1];
    $gitdir = $argv[2];
    if ($dbname && $gitdir){        
        echo "Dumping database: $dbname to $gitdir\n";
        // $collectionNames=array('sites','users','archives','system.indexes','fs.files');
        
        // should we add system.indexes ??
        $collectionNames = getCollections($dbname);
        foreach ($collectionNames as $collectionName) {
            $backupDir = backupDir($gitdir,$dbname,$collectionName,true);
            if (substr($collectionName,-strlen('chunks'))=='chunks'){ // ends with .chunks
                saveFiles($dbname,$collectionName,$backupDir);
            } else {
                saveCollection($dbname,$collectionName,$backupDir);
            }
        }

    } else {
        echo "Usage php dump.php <dbname> <gitdir>\n";
    }
}

function getDB($dbname){
    $m = new Mongo("mongodb://localhost/", array("persist" => "onlyone"));
    $db = $m->selectDB($dbname);
    return $db;
}

function getCollections($dbname){
    $db = getDB($dbname);

    // just return the names
    $collectionNames=array();

    $list = $db->listCollections();
    foreach ($list as $collection) {
        $name = str_replace($dbname.'.','',$collection->getName());
        array_push($collectionNames,$name);
    }    
    return $collectionNames;
}

function getCollection($dbname,$collectionName){
    $db = getDB($dbname);
    $collection = $db->selectCollection($collectionName);
    return $collection;
}

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

function saveCollection($dbname,$collectionName,$backupDir) {
    $collection = getCollection($dbname,$collectionName);
    $cursor = $collection->find();
    $docs = array_values(iterator_to_array($cursor));
    rewriteMongoOut($docs);
    
    echo "$collectionName has ". $cursor->count()." entries. saving to $backupDir\n";
    foreach ($docs as $doc) {
        #echo "saving object ".$doc['_id']."\n";
        saveDoc($doc, $backupDir,true);
    }
}

function saveDoc($object, $backupDir,$pretty) {
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

function saveFiles($dbname,$chunkCollectionName,$backupDir) {
    // get files collection associated with this chunk collection
    $fileCollectionName = str_replace('.chunks','.files',$chunkCollectionName);
    $files = getCollection($dbname,$fileCollectionName);
    $cursor = $files->find();
    echo "Saving chunks($chunkCollectionName) for files($fileCollectionName) to $backupDir\n";
    $count=0;
    foreach ($cursor as $file) {
        $strid = "".$file['_id'];
        saveFile($strid,$backupDir);
        $count++;
    }
    echo "$chunkCollectionName grouped into ". $count." files. saved to $backupDir\n";
}
function saveFile($strid,$backupDir){
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
    // decode base64
    $data = base64_decode($data);

    $tmpfile='files/'.$id.'-php.png';
    $fp = fopen($tmpfile, 'w');
    fwrite($fp, $data);
    fclose($fp);

    $tmpfile=$backupDir.'/'.$id.'.png';
    $fp = fopen($tmpfile, 'w');
    fwrite($fp, $data);
    fclose($fp);
    

    $type = exif_imagetype($tmpfile);
    $mimetype = image_type_to_mime_type($type);
    // error_log('file:'.$id.' length:'.strlen($data).' md5:'.md5($data).' type:'.$mimetype);

}

?>