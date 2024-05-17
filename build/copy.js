import libraries from './libraries.js'

import fs from 'fs';
import path from 'path';

const emptyFolderRecursive = function (directoryPath) {
    if (fs.existsSync(directoryPath)) {
      fs.readdirSync(directoryPath).forEach((file, index) => {
        const curPath = path.join(directoryPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          // recurse
          emptyFolderRecursive(curPath);
        } else {
          // delete file
          fs.unlinkSync(curPath);
        }
      });
      //fs.rmdirSync(directoryPath);
    }
  };
emptyFolderRecursive('./dist/pvtables')

let importmaps = {}
for(let key in libraries){
    importmaps['pvtables/' + key] = key +'.js'
    fs.copyFile('./' + key + '/' + key +'.js', './dist/pvtables/' + key +'.js', (err) => {
        if (err) {
          console.log("Error Found:", err);
        }
    });
}
fs.writeFile('./dist/pvtables/importmaps.json', JSON.stringify(importmaps), function (err) {
    if (err) throw err;
    console.log('It\'s saved!');
});
   
