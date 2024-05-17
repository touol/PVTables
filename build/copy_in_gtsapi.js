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
emptyFolderRecursive('../gtsAPI/assets/components/gtsapi/js/web/pvtables')

fs.cpSync('./dist/pvtables', '../gtsAPI/assets/components/gtsapi/js/web/pvtables', {recursive: true});
   
