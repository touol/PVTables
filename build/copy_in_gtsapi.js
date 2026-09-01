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

fs.cpSync('./dist', '../gtsAPI/assets/components/gtsapi/js/web/pvtables', {recursive: true});

// Контракт токенов отдельным файлом.
//
// Он и так попадает в собранный pvtables.css, но тот подключается только на
// страницах с Vue-приложением. На обычных страницах сайта PVTables нет, а
// переключатель темы есть — и без контракта файлы тем бесполезны: они
// объявляют приватные пары --_x-l/--_x-d, а собрать из них публичные --gts-*
// некому.
//
// Копируем из исходника, а не держим вторую копию руками: иначе два файла
// разъедутся, и тема на сайте начнёт отличаться от темы в приложении.
fs.copyFileSync(
    './src/theme/gts-tokens.css',
    '../gtsAPI/assets/components/gtsapi/css/web/gts-tokens.css'
);
console.log('gts-tokens.css скопирован в gtsAPI');
   
